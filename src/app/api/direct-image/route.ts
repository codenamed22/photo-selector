import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import heicConvert from 'heic-convert';
import sharp from 'sharp';
import {
  validateImagePath,
  validateBoolean,
  ValidationError,
  sanitizeErrorMessage,
} from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawPath = searchParams.get('path');
    const rawPreview = searchParams.get('preview');

    // Validate inputs
    const imagePath = validateImagePath(rawPath);
    const isPreview = validateBoolean(rawPreview, false);

  if (!fs.existsSync(imagePath)) {
    return new Response('File not found', { status: 404 });
  }

  const stats = fs.statSync(imagePath);
  if (!stats.isFile()) {
    return new Response('Path is not a file', { status: 400 });
  }

  const ext = path.extname(imagePath).toLowerCase();
  let contentType = 'image/jpeg';
  let buffer: Buffer;

  async function processImage(inputBuffer: Buffer, format: string) {
    if (isPreview) {
      return await sharp(inputBuffer)
        .resize(64, 64, { fit: 'cover', withoutEnlargement: true })
        .jpeg({ quality: 60, progressive: true })
        .toBuffer();
    }

    if (format === 'JPEG') {
      return await sharp(inputBuffer).jpeg({ quality: 100 }).toBuffer();
    }
    return inputBuffer;
  }

  if (ext === '.heic' || ext === '.heif') {
    const inputBuffer = fs.readFileSync(imagePath);
    const heicBuffer = await heicConvert({
      buffer: inputBuffer.buffer as ArrayBuffer,
      format: 'JPEG',
      quality: isPreview ? 0.6 : 1.0
    });
    buffer = await processImage(Buffer.from(heicBuffer), 'JPEG');
    contentType = 'image/jpeg';
  } else {
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
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    const status = error instanceof ValidationError ? 400 : 500;
    return new Response(message, { status });
  }
}