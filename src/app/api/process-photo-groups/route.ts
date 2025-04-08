import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { photoGroups } = await request.json();
    
    if (!photoGroups || !Array.isArray(photoGroups)) {
      return NextResponse.json({ error: 'Invalid photo groups' }, { status: 400 });
    }
    
    const results = [];
    
    // Process each group sequentially to avoid overwhelming the API
    for (const [groupIndex, group] of photoGroups.entries()) {
      try {
        // Skip empty groups
        if (!group || group.length === 0) {
          continue;
        }
        
        // For single-photo groups, automatically select that photo
        if (group.length === 1) {
          results.push({
            groupId: groupIndex,
            bestPhotoId: group[0].id,
            bestPhotoPath: group[0].path,
            score: 100, // Perfect score for single photos
          });
          continue;
        }
        
        // Call the analyze-photos endpoint for each group
        const response = await fetch(new URL('/api/analyze-photos', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            photoPaths: group.map((photo : {path: string}) => photo.path),
            groupId: groupIndex,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Error analyzing group ${groupIndex}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.bestPhoto) {
          // Find the photo ID that matches the best photo path
          const bestPhotoPath = data.bestPhoto.path;
          const bestPhoto = group.find((photo: {path: string}) => photo.path === bestPhotoPath);
          
          results.push({
            groupId: groupIndex,
            bestPhotoId: bestPhoto?.id,
            bestPhotoPath: data.bestPhoto.path,
            score: data.bestPhoto.overallScore,
          });
        } else {
          throw new Error(`No best photo identified for group ${groupIndex}`);
        }
      } catch (error) {
        console.error(`Error processing group ${groupIndex}:`, error);
        results.push({
          groupId: groupIndex,
          error: (error as Error).message,
        });
      }
    }
    
    return NextResponse.json({ results });
    
  } catch (error: any) {
    console.error('Error processing photo groups:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}