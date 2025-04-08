import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
const { DefaultAzureCredential } = require("@azure/identity");  
const { AzureOpenAI } = require("openai");  
const dotenv = require("dotenv");  

dotenv.config();

// Azure OpenAI configuration
const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "endpoint";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "GPT-4O-RD";
const apiVersion = "2024-05-01-preview";

// AI-based photo quality analysis
async function analyzePhotoQuality(photoPath: string) {
  // Check if the file exists and is accessible
  if (!fs.existsSync(photoPath)) {
    throw new Error(`File not found: ${photoPath}`);
  }

  // Read the image file as a buffer
  const imageBuffer = fs.readFileSync(photoPath);
  
  // Convert image to base64
  const base64Image = imageBuffer.toString('base64');
  const mimeType = determineMimeType(photoPath);
  const dataUri = `data:${mimeType};base64,${base64Image}`;
  
  // Initialize the Azure OpenAI client
  const credential = new DefaultAzureCredential();
  const client = new AzureOpenAI({ 
    endpoint, 
    credential, 
    apiVersion, 
    deployment
  });
  
  // Create the prompt for analyzing image quality
  const messages = [
    {
      role: "system",
      content: "You are an expert photographer and image quality analyst. Analyze the provided image and rate it on quality metrics."
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Analyze this photo and rate it on these aspects (from 0-100):\n1. Overall quality\n2. Sharpness\n3. Exposure\n4. Composition\n\nGive me ONLY a JSON object with these four scores and no other text."
        },
        {
          type: "image_url",
          image_url: {
            url: dataUri
          }
        }
      ]
    }
  ];
  
  // Call the Azure OpenAI API with the updated method
  const result = await client.chat.completions.create({
    messages,
    max_tokens: 800,
    temperature: 0.7,
    top_p: 0.95,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  
  // Extract the response content
  const responseContent = result.choices[0]?.message?.content || "";
  
  // Find JSON object in the response (in case there's additional text)
  const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : responseContent;
  
  try {
    const analysisResult = JSON.parse(jsonStr);
    
    // Ensure all required metrics are present
    return {
      quality: analysisResult.quality || analysisResult["Overall quality"] || 0,
      sharpness: analysisResult.sharpness || analysisResult["Sharpness"] || 0,
      exposure: analysisResult.exposure || analysisResult["Exposure"] || 0,
      composition: analysisResult.composition || analysisResult["Composition"] || 0
    };
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError);
    console.log("Raw response:", responseContent);
    if (parseError instanceof Error) {
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    } else {
      throw new Error("Failed to parse AI response: Unknown error");
    }
  }
}

// Helper function to determine MIME type based on file extension
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
    case '.bmp':
      return 'image/bmp';
    case '.heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

export async function POST(request: Request) {
  try {
    const { photoPaths, groupId } = await request.json();
    
    if (!photoPaths || !Array.isArray(photoPaths)) {
      return NextResponse.json({ error: 'Invalid photo paths' }, { status: 400 });
    }
    
    // Analyze each photo
    const results = await Promise.all(
      photoPaths.map(async (photoPath) => {
        try {
          // Check if file exists
          if (!fs.existsSync(photoPath)) {
            return { path: photoPath, error: 'File not found' };
          }
          
          // Analyze the photo using Azure OpenAI
          const analysis = await analyzePhotoQuality(photoPath);
          
          return {
            path: photoPath,
            analysis,
          };
        } catch (err: any) {
          // Pass through the error without fallback
          return { path: photoPath, error: (err as Error).message };
        }
      })
    );
    
    // Calculate overall quality score
    const scoredResults = results.map(result => {
      if (result.error || !result.analysis) return { ...result, overallScore: 0 };
      
      // Calculate overall score (weighted average)
      const { quality, sharpness, exposure, composition } = result.analysis;
      const overallScore = (
        quality * 0.3 + 
        sharpness * 0.3 + 
        exposure * 0.2 + 
        composition * 0.2
      );
      
      return { ...result, overallScore };
    });
    
    // Sort results by overall score (descending)
    scoredResults.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
    
    return NextResponse.json({ 
      results: scoredResults,
      groupId,
      bestPhoto: scoredResults.length > 0 ? scoredResults[0] : null
    });
    
  } catch (error: any) {
    console.error('Error analyzing photos:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}