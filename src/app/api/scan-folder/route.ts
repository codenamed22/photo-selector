import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  validateFolderPath,
  validateBoolean,
  validateEps,
  validateMinPts,
  ValidationError,
  createErrorResponse,
} from '@/lib/validation';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate inputs
    const folderPath = validateFolderPath(body.folderPath);
    const autoGroup = validateBoolean(body.autoGroup, false);
    const eps = validateEps(body.eps ?? 0.25);
    const minPts = validateMinPts(body.minPts ?? 2);
    
    // Check folder exists
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        return NextResponse.json(
          { error: 'Path is not a directory' },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Folder does not exist or is not accessible' },
        { status: 400 }
      );
    }
    
    const { photos, stats } = await scanFolder(folderPath);
    
    if (!autoGroup) {
      return NextResponse.json({ photos, stats });
    }

    const groupResponse = await fetch(new URL('/api/group-photos', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos, eps, minPts }),
    });

    if (!groupResponse.ok) {
      return NextResponse.json({ photos, stats });
    }

    const groupData = await groupResponse.json();

    return NextResponse.json({
      photos,
      stats,
      groups: groupData.groups,
      ungrouped: groupData.ungrouped,
      groupStats: groupData.stats
    });
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(createErrorResponse(error, 400), { status: 400 });
    }
    console.error('Error scanning folder:', error);
    return NextResponse.json(createErrorResponse(error, 500), { status: 500 });
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