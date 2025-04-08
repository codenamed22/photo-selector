import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // A tiny 1x1 transparent pixel as base64
  const transparentPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  
  return Response.json({
    data: transparentPixel,
    success: true
  });
}