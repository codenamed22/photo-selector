import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Uber GenAI API Gateway configuration
const client = new OpenAI({
  baseURL: process.env.GENAI_GATEWAY_URL || 'http://127.0.0.1:5436/v1', // Use 127.0.0.1 instead of localhost to force IPv4
  apiKey: 'dummy', // Required by SDK but not used by gateway
  organization: process.env.MA_STUDIO_PROJECT_UUID, // Your MA Studio project UUID
  defaultHeaders: {
    'Rpc-Service': 'genai-api',
    'Rpc-Caller': process.env.SERVICE_NAME || 'photo-selector',
  },
});

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
  console.log(`Analyzing ${photoPaths.length} photos with multimodal LLM...`);

  // Prepare images for the API
  const imageContents = photoPaths.map((photoPath, index) => {
    const imageBuffer = fs.readFileSync(photoPath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = determineMimeType(photoPath);
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    return {
      type: 'image_url' as const,
      image_url: {
        url: dataUrl,
        detail: 'high' as const
      }
    };
  });

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

  const response = await client.chat.completions.create({
    model: process.env.MODEL_NAME || 'gpt-4o', // or gemini-2.0-flash-001 for multimodal
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imageContents
        ]
      }
    ],
    max_tokens: 2000,
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No response from LLM');
  }

  console.log('LLM Response:', content);

  // Parse the JSON response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from LLM response');
  }

  const analysis = JSON.parse(jsonMatch[0]);
  
  // Build the result
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
    const { photoPaths } = await request.json();
    
    if (!photoPaths || !Array.isArray(photoPaths) || photoPaths.length === 0) {
      return NextResponse.json({ error: 'Invalid photo paths' }, { status: 400 });
    }

    console.log(`Analyzing ${photoPaths.length} photos for best selection using LLM...`);
    console.log('Photo paths:', photoPaths);

    const result = await analyzePhotosWithLLM(photoPaths);

    console.log(`Best photo selected: ${result.bestPhoto.path} (score: ${result.bestPhoto.finalScore.toFixed(2)})`);
    console.log(`Reasoning: ${result.bestPhoto.reasoning}`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error selecting best photo:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack
    });
    
    return NextResponse.json({ 
      error: errorMessage,
      details: errorStack
    }, { status: 500 });
  }
}

