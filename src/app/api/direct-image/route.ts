import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imagePath = searchParams.get('path');

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

  // Determine content type
  const ext = path.extname(imagePath).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  if (ext === '.gif') contentType = 'image/gif';
  if (ext === '.webp') contentType = 'image/webp';
  if (ext === '.svg') contentType = 'image/svg+xml';

  const fileStream = fs.createReadStream(imagePath);
  return new Response(fileStream as any, {
    headers: { 'Content-Type': contentType }
  });
}