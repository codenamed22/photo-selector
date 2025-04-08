import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Helper function to check if path is within allowed directories
function isPathSafe(filePath: string): boolean {
  // Add your allowed directories here
  const userHome = os.homedir();
  const allowedDirs = [
    userHome,
    // Add other allowed directories if needed
  ];
  
  // Normalize the path to resolve any ../ etc.
  const normalizedPath = path.normalize(filePath);
  
  // Check if the path is within any allowed directory
  return allowedDirs.some(dir => normalizedPath.startsWith(dir));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }
    
    // Security check
    if (!isPathSafe(filePath)) {
      return NextResponse.json({ 
        error: 'Access denied: Path is outside of allowed directories',
        requested: filePath
      }, { status: 403 });
    }
    
    const fileInfo: {
      requested: string;
      exists: boolean;
      isDirectory: boolean;
      isFile: boolean;
      size: number | null;
      stats: any | null;
      error: string | null;
      osInfo: {
        platform: string;
        homedir: string;
        tmpdir: string;
      };
    } = {
      requested: filePath,
      exists: false,
      isDirectory: false,
      isFile: false,
      size: null,
      stats: null,
      error: null,
      osInfo: {
        platform: os.platform(),
        homedir: os.homedir(),
        tmpdir: os.tmpdir()
      }
    };
    
    try {
      // Use async file operations
      const stats = await fs.stat(filePath).catch(() => null);
      
      if (stats) {
        fileInfo.exists = true;
        fileInfo.isDirectory = stats.isDirectory();
        fileInfo.isFile = stats.isFile();
        fileInfo.size = stats.size;
        fileInfo.stats = {
          mode: stats.mode,
          mtime: stats.mtime,
          ctime: stats.ctime,
          birthtime: stats.birthtime
        };
      }
    } catch (error) {
      fileInfo.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    return NextResponse.json(fileInfo);
  } catch (error) {
    return NextResponse.json({ 
      error: 'Server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}