import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import heicConvert from 'heic-convert';

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
        const extension = path.extname(file).toLowerCase();
        const baseFilename = path.basename(file, extension);
        
        // Handle HEIC files by converting to JPEG
        if (extension === '.heic' || extension === '.heif') {
          const inputBuffer = await fs.readFile(file);
          const outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: 'JPEG',
            quality: 1.0  // Maximum quality (100%)
          });
          
          // Save as JPEG
          const destination = path.join(destinationFolder, `${baseFilename}.jpg`);
          await fs.writeFile(destination, outputBuffer);
          return { 
            path: file, 
            success: true, 
            converted: true,
            newPath: destination 
          };
        } else {
          // Regular file copy for non-HEIC files
          const destination = path.join(destinationFolder, path.basename(file));
          await fs.copyFile(file, destination);
          return { 
            path: file, 
            success: true,
            converted: false,
            newPath: destination 
          };
        }
      })
    );
    
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected').length;
    
    const converted = successful.filter(r => 
      r.status === 'fulfilled' && r.value.converted
    ).length;
    
    const copied = successful.length;
    
    return NextResponse.json({
      message: `Copied ${copied} files (${converted} converted from HEIC), ${failed} failed`,
      copied,
      converted,
      failed,
      results: successful.map(r => r.status === 'fulfilled' ? r.value : null)
    });
  } catch (error) {
    console.error('Error copying files:', error);
    return NextResponse.json(
      { error: 'Failed to copy files' },
      { status: 500 }
    );
  }
}