import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export async function POST(req: NextRequest) {
  try {
    const { folderPath } = await req.json();
    
    if (!folderPath) {
      return NextResponse.json(
        { error: 'Folder path is required' },
        { status: 400 }
      );
    }
    
    // Check if folder exists
    try {
      await fs.access(folderPath);
    } catch (error) {
      return NextResponse.json(
        { error: 'Folder does not exist or is not accessible' },
        { status: 400 }
      );
    }
    
    const photos = await scanFolder(folderPath);
    
    return NextResponse.json({ photos });
  } catch (error) {
    console.error('Error scanning folder:', error);
    return NextResponse.json(
      { error: 'Failed to scan folder' },
      { status: 500 }
    );
  }
}

async function scanFolder(folderPath: string): Promise<any[]> {
  const photos: any[] = [];
  
  async function scan(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          photos.push({
            id: Buffer.from(fullPath).toString('base64'),
            path: fullPath,
            filename: entry.name,
            selected: false
          });
        }
      }
    }
  }
  
  await scan(folderPath);
  return photos;
}