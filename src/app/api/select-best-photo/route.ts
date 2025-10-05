import { NextResponse } from 'next/server';
import path from 'path';
import sharp from 'sharp';
import { createLLMClient, getModelName } from '@/lib/llm-client';
import {
  validatePhotoPaths,
  ValidationError,
  createErrorResponse,
} from '@/lib/validation';

// Lazy-load LLM client to avoid initialization at build time
let client: ReturnType<typeof createLLMClient> | null = null;

function getLLMClient() {
  if (!client) {
    client = createLLMClient();
  }
  return client;
}

export interface BestPhotoResult {
  bestPhoto: {
    path: string;
    finalScore: number;
    imageQualityScore: number;
    faceQualityScore: number;
    reasoning: string;
  };
  allPhotos: Array<{
    path: string;
    finalScore: number;
    imageQuality: {
      sharpness: number;
      brightness: number;
      composition: number;
    };
    faceQuality: {
      allEyesOpen: boolean;
      faceCount: number;
      faceScore: number;
    };
    reasoning: string;
  }>;
}

function determineMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.heic':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

async function analyzePhotosWithLLM(photoPaths: string[]): Promise<BestPhotoResult> {
  const imageContents = await Promise.all(photoPaths.map(async (photoPath) => {
    const resizedBuffer = await sharp(photoPath)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    const base64Image = resizedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    
    return {
      type: 'image_url' as const,
      image_url: { url: dataUrl, detail: 'high' as const }
    };
  }));

  const prompt = `You are an expert photo quality analyst. Analyze these ${photoPaths.length} photos and determine which one is the best quality.

Evaluate each photo based on:
1. **Sharpness/Focus**: Is the image sharp and in focus? (0-100)
2. **Brightness/Exposure**: Is the lighting good? Not too dark or overexposed? (0-100)
3. **Composition**: Is the framing and composition good? (0-100)
4. **Face Quality** (if faces present): Are eyes open? Are faces clear and well-lit? (0-100)

For each photo, provide:
- Sharpness score (0-100)
- Brightness score (0-100)
- Composition score (0-100)
- Face score (0-100, or N/A if no faces)
- Whether all eyes are open (true/false, or N/A)
- Number of faces detected
- Brief reasoning (1-2 sentences)
- Overall final score (0-100)

Then determine which photo is the BEST overall and explain why.

Respond in this EXACT JSON format:
{
  "photos": [
    {
      "photoIndex": 0,
      "sharpness": 85,
      "brightness": 90,
      "composition": 80,
      "faceScore": 75,
      "allEyesOpen": true,
      "faceCount": 2,
      "reasoning": "Sharp image with good lighting...",
      "finalScore": 82.5
    }
  ],
  "bestPhotoIndex": 0,
  "bestPhotoReasoning": "Photo 1 is the best because..."
}`;

  const llmClient = getLLMClient();
  const response = await llmClient.chat.completions.create({
    model: getModelName(),
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: prompt }, ...imageContents]
    }],
    max_tokens: 2000,
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from LLM');

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON from LLM response');

  const analysis = JSON.parse(jsonMatch[0]);
  const allPhotos = photoPaths.map((photoPath, index) => {
    const photoAnalysis = analysis.photos[index];
    
    return {
      path: photoPath,
      finalScore: photoAnalysis.finalScore,
      imageQuality: {
        sharpness: photoAnalysis.sharpness,
        brightness: photoAnalysis.brightness,
        composition: photoAnalysis.composition,
      },
      faceQuality: {
        allEyesOpen: photoAnalysis.allEyesOpen === true,
        faceCount: photoAnalysis.faceCount || 0,
        faceScore: photoAnalysis.faceScore || 0,
      },
      reasoning: photoAnalysis.reasoning
    };
  });

  const bestPhotoIndex = analysis.bestPhotoIndex;
  const bestPhoto = allPhotos[bestPhotoIndex];

  return {
    bestPhoto: {
      path: bestPhoto.path,
      finalScore: bestPhoto.finalScore,
      imageQualityScore: (bestPhoto.imageQuality.sharpness + bestPhoto.imageQuality.brightness + bestPhoto.imageQuality.composition) / 3,
      faceQualityScore: bestPhoto.faceQuality.faceScore,
      reasoning: analysis.bestPhotoReasoning
    },
    allPhotos
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate inputs (max 10 photos for LLM analysis to avoid token limits)
    const photoPaths = validatePhotoPaths(body.photoPaths, { maxCount: 10, maxLength: 1000 });

    const result = await analyzePhotosWithLLM(photoPaths);
    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(createErrorResponse(error, 400), { status: 400 });
    }
    console.error('Error selecting best photo:', error);
    return NextResponse.json(createErrorResponse(error, 500), { status: 500 });
  }
}

