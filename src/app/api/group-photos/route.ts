import { NextResponse } from 'next/server';
import { dbscan } from '@/utils/clustering';
import {
  validatePhotosArray,
  validateEps,
  validateMinPts,
  ValidationError,
  createErrorResponse,
} from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate inputs
    const photos = validatePhotosArray(body.photos, { maxCount: 1000 });
    const eps = validateEps(body.eps ?? 0.25);
    const minPts = validateMinPts(body.minPts ?? 2);

    const photoPathsToEmbed = photos.map((photo: any) => photo.path);
    
    const embeddingsResponse = await fetch(
      new URL('/api/generate-embeddings', request.url).toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoPaths: photoPathsToEmbed }),
      }
    );

    if (!embeddingsResponse.ok) {
      throw new Error('Failed to generate embeddings');
    }

    const { embeddings } = await embeddingsResponse.json();

    const validEmbeddings = embeddings.filter((e: any) => e.embedding !== null);
    const embeddingVectors = validEmbeddings.map((e: any) => e.embedding);
    
    // Store embeddings for similarity calculations in results page
    const embeddingsForClient = validEmbeddings.map((e: any) => ({
      path: e.path,
      embedding: e.embedding
    }));

    if (embeddingVectors.length === 0) {
      return NextResponse.json({
        groups: [],
        ungrouped: photos,
        embeddings: [],
        stats: {
          totalPhotos: photos.length,
          groupCount: 0,
          ungroupedCount: photos.length,
        }
      });
    }

    console.log(`Running DBSCAN with eps=${eps}, minPts=${minPts} on ${embeddingVectors.length} photos`);
    const { clusters, noise } = dbscan(embeddingVectors, eps, minPts);
    console.log(`DBSCAN results: ${clusters.length} clusters, ${noise.length} noise points`);

    const photoGroups = clusters.map((clusterIndices) => {
      return clusterIndices.map(idx => {
        const embeddingData = validEmbeddings[idx];
        return photos.find((p: any) => p.path === embeddingData.path);
      }).filter(Boolean);
    });

    const ungroupedPhotos = noise.map(idx => {
      const embeddingData = validEmbeddings[idx];
      return photos.find((p: any) => p.path === embeddingData.path);
    }).filter(Boolean);

    const failedEmbeddings = embeddings.filter((e: any) => e.embedding === null);
    failedEmbeddings.forEach((e: any) => {
      const photo = photos.find((p: any) => p.path === e.path);
      if (photo) {
        ungroupedPhotos.push(photo);
      }
    });

    return NextResponse.json({
      groups: photoGroups,
      ungrouped: ungroupedPhotos,
      embeddings: embeddingsForClient,
      stats: {
        totalPhotos: photos.length,
        groupCount: photoGroups.length,
        ungroupedCount: ungroupedPhotos.length,
        avgGroupSize: photoGroups.length > 0 
          ? photoGroups.reduce((sum, g) => sum + g.length, 0) / photoGroups.length 
          : 0,
      }
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(createErrorResponse(error, 400), { status: 400 });
    }
    console.error('Error grouping photos:', error);
    return NextResponse.json(createErrorResponse(error, 500), { status: 500 });
  }
}
