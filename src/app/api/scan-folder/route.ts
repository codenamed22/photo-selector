import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];

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
    
    console.log('Starting folder scan:', folderPath);
    const { photos, stats } = await scanFolder(folderPath);
    console.log('Scan complete:', stats);
    
    return NextResponse.json({ 
      photos,
      stats
    });
  } catch (error) {
    console.error('Error scanning folder:', error);
    return NextResponse.json(
      { error: 'Failed to scan folder' },
      { status: 500 }
    );
  }
}

interface ScanStats {
  totalFiles: number;
  supportedFiles: number;
  byExtension: Record<string, number>;
}

async function scanFolder(folderPath: string): Promise<{ photos: any[], stats: ScanStats }> {
  const photos: any[] = [];
  const stats: ScanStats = {
    totalFiles: 0,
    supportedFiles: 0,
    byExtension: {}
  };
  
  async function scan(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        stats.totalFiles++;
        const ext = path.extname(entry.name).toLowerCase();
        
        // Track extension stats
        stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;
        
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          stats.supportedFiles++;
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
  return { photos, stats };
}