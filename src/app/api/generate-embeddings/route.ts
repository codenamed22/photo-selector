import { NextResponse } from 'next/server';
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage } from '@xenova/transformers';
import fs from 'fs';
import {
  validatePhotoPaths,
  ValidationError,
  createErrorResponse,
} from '@/lib/validation';

// Type definitions for CLIP model components
type ImageProcessor = Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
type VisionModel = Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>>;

interface ModelCache {
  imageProcessor: ImageProcessor | null;
  visionModel: VisionModel | null;
  initializationPromise: Promise<{ imageProcessor: ImageProcessor; visionModel: VisionModel }> | null;
}

// Module-level cache with proper typing
const modelCache: ModelCache = {
  imageProcessor: null,
  visionModel: null,
  initializationPromise: null,
};

/**
 * Initialize CLIP model with race condition prevention
 * Multiple concurrent requests will wait for the same initialization
 */
async function initializeModel(): Promise<{ imageProcessor: ImageProcessor; visionModel: VisionModel }> {
  // If already initialized, return cached models
  if (modelCache.imageProcessor && modelCache.visionModel) {
    return {
      imageProcessor: modelCache.imageProcessor,
      visionModel: modelCache.visionModel,
    };
  }

  // If initialization is in progress, wait for it
  if (modelCache.initializationPromise) {
    return await modelCache.initializationPromise;
  }

  // Start new initialization and cache the promise
  modelCache.initializationPromise = (async () => {
    try {
      console.log('🔄 Loading CLIP model (first time only)...');
      const startTime = Date.now();

      const [processor, model] = await Promise.all([
        AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32'),
        CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32'),
      ]);

      modelCache.imageProcessor = processor;
      modelCache.visionModel = model;

      const loadTime = Date.now() - startTime;
      console.log(`✅ CLIP model loaded successfully in ${loadTime}ms (~${Math.round(loadTime / 1000)}s)`);

      return {
        imageProcessor: processor,
        visionModel: model,
      };
    } catch (error) {
      // Clear the promise on error so next request can retry
      modelCache.initializationPromise = null;
      throw error;
    }
  })();

  return await modelCache.initializationPromise;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate inputs
    const photoPaths = validatePhotoPaths(body.photoPaths, { maxCount: 1000, maxLength: 1000 });

    const { imageProcessor, visionModel } = await initializeModel();

    const embeddings = await Promise.all(
      photoPaths.map(async (photoPath: string) => {
        try {
          const embedding = await generateImageEmbedding(photoPath, imageProcessor, visionModel);
          return {
            path: photoPath,
            embedding,
            error: null
          };
        } catch (err) {
          console.error(`Error generating embedding for ${photoPath}:`, err);
          return {
            path: photoPath,
            embedding: null,
            error: (err as Error).message
          };
        }
      })
    );

    return NextResponse.json({ embeddings });
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(createErrorResponse(error, 400), { status: 400 });
    }
    console.error('Error generating embeddings:', error);
    return NextResponse.json(createErrorResponse(error, 500), { status: 500 });
  }
}

/**
 * Generate CLIP embedding for a single image
 */
async function generateImageEmbedding(
  photoPath: string, 
  processor: ImageProcessor, 
  model: VisionModel
): Promise<number[]> {
  if (!fs.existsSync(photoPath)) {
    throw new Error(`File not found: ${photoPath}`);
  }

  const image = await RawImage.read(photoPath);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  
  return Array.from(image_embeds.data);
}
