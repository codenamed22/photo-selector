import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import heicConvert from 'heic-convert';
import {
  validateImagePath,
  ValidationError,
  sanitizeErrorMessage,
} from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawPath = searchParams.get('path');
    
    // Validate input
    const imagePath = validateImagePath(rawPath);
    
    if (!fs.existsSync(imagePath)) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }
    
    const stats = fs.statSync(imagePath);
    if (!stats.isFile()) {
      return Response.json({ error: 'Path is not a file' }, { status: 400 });
    }
    
    const MAX_SIZE = 20 * 1024 * 1024;
    if (stats.size > MAX_SIZE) {
      return Response.json({ 
        tooLarge: true,
        size: stats.size,
        directUrl: `/api/direct-image?path=${encodeURIComponent(imagePath)}`
      });
    }
    
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      let processedBuffer = imageBuffer;
      
      const fileExtension = path.extname(imagePath).toLowerCase();
      let contentType = 'image/jpeg';
      
      if (fileExtension === '.heic' || fileExtension === '.heif') {
        try {
          const heicResult = await heicConvert({
            buffer: imageBuffer.buffer as ArrayBuffer,
            format: 'JPEG',
            quality: 0.9
          });
          processedBuffer = Buffer.from(heicResult);
          contentType = 'image/jpeg';
        } catch (error) {
          return Response.json({ 
            error: 'Failed to convert HEIC image',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      } else {
        if (fileExtension === '.png') contentType = 'image/png';
        if (fileExtension === '.gif') contentType = 'image/gif';
        if (fileExtension === '.webp') contentType = 'image/webp';
        if (fileExtension === '.svg') contentType = 'image/svg+xml';
      }
      
      const base64Image = processedBuffer.toString('base64');
      
      return Response.json({ 
        data: `data:${contentType};base64,${base64Image}`,
        success: true 
      });
    } catch (error) {
      return Response.json({ 
        error: 'Failed to process image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    const status = error instanceof ValidationError ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}