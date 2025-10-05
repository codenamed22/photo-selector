import { NextResponse } from 'next/server';
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage } from '@xenova/transformers';
import fs from 'fs';

let imageProcessor: any = null;
let visionModel: any = null;

async function initializeModel() {
  if (!imageProcessor || !visionModel) {
    imageProcessor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32');
    visionModel = await CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32');
  }
  return { imageProcessor, visionModel };
}

export async function POST(request: Request) {
  try {
    const { photoPaths } = await request.json();
    
    if (!photoPaths || !Array.isArray(photoPaths)) {
      return NextResponse.json({ error: 'Invalid photo paths' }, { status: 400 });
    }

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
    console.error('Error generating embeddings:', error);
    return NextResponse.json({ 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

async function generateImageEmbedding(
  photoPath: string, 
  processor: any, 
  model: any
): Promise<number[]> {
  if (!fs.existsSync(photoPath)) {
    throw new Error(`File not found: ${photoPath}`);
  }

  const image = await RawImage.read(photoPath);
  
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  
  return Array.from(image_embeds.data);
}
