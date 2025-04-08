import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Security validation
function isPathSafe(filePath: string): boolean {
  const userHome = os.homedir();
  const allowedDirs = [userHome];
  const normalizedPath = path.normalize(filePath);
  return allowedDirs.some(dir => normalizedPath.startsWith(dir));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imagePath = searchParams.get('path');
  
  console.log('---- Image API Request ----');
  console.log('Requested path:', imagePath);
  
  try {
    if (!imagePath) {
      console.log('Error: No path provided');
      return Response.json({ error: 'Image path is required' }, { status: 400 });
    }
    
    if (!isPathSafe(imagePath)) {
      console.log('Error: Path not safe:', imagePath);
      return Response.json({ error: 'Path is outside allowed directories' }, { status: 403 });
    }
    
    if (!fs.existsSync(imagePath)) {
      console.log('Error: File does not exist:', imagePath);
      return Response.json({ error: 'File not found' }, { status: 404 });
    }
    
    const stats = fs.statSync(imagePath);
    if (!stats.isFile()) {
      console.log('Error: Not a file:', imagePath);
      return Response.json({ error: 'Path is not a file' }, { status: 400 });
    }
    
    console.log('File stats:', {
      size: stats.size,
      mtime: stats.mtime,
      isFile: stats.isFile()
    });
    
    // If file is too large, return an error or use a different approach
    const MAX_SIZE = 20 * 1024 * 1024; // Increase to 20MB
    if (stats.size > MAX_SIZE) {
      console.log('File too large, sending direct URL:', stats.size);
      // Return a flag indicating this image is too large for base64
      return Response.json({ 
        tooLarge: true,
        size: stats.size,
        directUrl: `/api/direct-image?path=${encodeURIComponent(imagePath)}`
      });
    }
    
    try {
      // Read the file as base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Get MIME type
      const fileExtension = path.extname(imagePath).toLowerCase();
      let contentType = 'image/jpeg'; // Default
      if (fileExtension === '.png') contentType = 'image/png';
      if (fileExtension === '.gif') contentType = 'image/gif';
      if (fileExtension === '.webp') contentType = 'image/webp';
      if (fileExtension === '.svg') contentType = 'image/svg+xml';
      
      console.log('Successfully processed image:', {
        size: imageBuffer.length,
        extension: fileExtension,
        contentType: contentType,
        base64Length: base64Image.length
      });
      
      // Return as JSON with base64 data
      return Response.json({ 
        data: `data:${contentType};base64,${base64Image}`,
        success: true 
      });
    } catch (error) {
      console.error('Error processing image:', error);
      return Response.json({ 
        error: 'Failed to process image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Server error:', error);
    return Response.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}