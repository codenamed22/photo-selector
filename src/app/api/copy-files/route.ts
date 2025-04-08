import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { files, destinationFolder } = await req.json();
    
    if (!files || !Array.isArray(files) || !destinationFolder) {
      return NextResponse.json(
        { error: 'Files array and destination folder are required' },
        { status: 400 }
      );
    }
    
    // Create destination folder if it doesn't exist
    try {
      await fs.mkdir(destinationFolder, { recursive: true });
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to create destination folder' },
        { status: 500 }
      );
    }
    
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const filename = path.basename(file);
        const destination = path.join(destinationFolder, filename);
        await fs.copyFile(file, destination);
        return { path: file, success: true };
      })
    );
    
    const copied = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return NextResponse.json({
      message: `Copied ${copied} files, ${failed} failed`,
      copied,
      failed
    });
  } catch (error) {
    console.error('Error copying files:', error);
    return NextResponse.json(
      { error: 'Failed to copy files' },
      { status: 500 }
    );
  }
}