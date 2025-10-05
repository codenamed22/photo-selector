import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import heicConvert from 'heic-convert';
import sharp from 'sharp';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imagePath = searchParams.get('path');
  const isPreview = searchParams.get('preview') === 'true';

  if (!imagePath) {
    return new Response('Image path is required', { status: 400 });
  }

  // No security: allow any path
  if (!fs.existsSync(imagePath)) {
    return new Response('File not found', { status: 404 });
  }

  const stats = fs.statSync(imagePath);
  if (!stats.isFile()) {
    return new Response('Path is not a file', { status: 400 });
  }

  // Determine content type and handle conversion if needed
  const ext = path.extname(imagePath).toLowerCase();
  let contentType = 'image/jpeg';
  let buffer: Buffer;

  async function processImage(inputBuffer: Buffer, format: string) {
    let processedBuffer = inputBuffer;

    if (isPreview) {
      // For previews, create a small, low-quality version
      processedBuffer = await sharp(inputBuffer)
        .resize(64, 64, { 
          fit: 'cover',
          withoutEnlargement: true 
        })
        .jpeg({ 
          quality: 60,
          progressive: true 
        })
        .toBuffer();
      return processedBuffer;
    }

    // For full-size images, convert if needed
    if (format === 'JPEG') {
      processedBuffer = await sharp(inputBuffer)
        .jpeg({ quality: 100 })
        .toBuffer();
    }
    return processedBuffer;
  }

  if (ext === '.heic' || ext === '.heif') {
    // For HEIC files, convert to JPEG
    const inputBuffer = fs.readFileSync(imagePath);
    const heicBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: isPreview ? 0.6 : 1.0
    });
    buffer = await processImage(heicBuffer, 'JPEG');
    contentType = 'image/jpeg';
  } else {
    // For other formats, process directly
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.gif') contentType = 'image/gif';
    if (ext === '.webp') contentType = 'image/webp';
    if (ext === '.svg') contentType = 'image/svg+xml';
    const inputBuffer = fs.readFileSync(imagePath);
    buffer = await processImage(inputBuffer, ext.substring(1).toUpperCase());
  }

  return new Response(new Uint8Array(buffer), {
    headers: { 
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    }
  });
}