export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

export function cosineDistance(vecA: number[], vecB: number[]): number {
  return 1 - cosineSimilarity(vecA, vecB);
}

interface Point {
  index: number;
  embedding: number[];
  clusterId?: number;
  visited?: boolean;
}

export interface ClusterResult {
  clusters: number[][];
  noise: number[];
}

export function dbscan(
  embeddings: number[][],
  eps: number = 0.3,
  minPts: number = 2
): ClusterResult {
  const points: Point[] = embeddings.map((embedding, index) => ({
    index,
    embedding,
    visited: false,
    clusterId: -1
  }));

  let clusterId = 0;

  function regionQuery(pointIdx: number): number[] {
    const neighbors: number[] = [pointIdx]; // Include the point itself
    const currentPoint = points[pointIdx];

    for (let i = 0; i < points.length; i++) {
      if (i === pointIdx) continue;
      
      const distance = cosineDistance(currentPoint.embedding, points[i].embedding);
      
      if (distance <= eps) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  function expandCluster(pointIdx: number, neighbors: number[], clusterId: number): void {
    points[pointIdx].clusterId = clusterId;

    let i = 0;
    while (i < neighbors.length) {
      const neighborIdx = neighbors[i];
      const neighbor = points[neighborIdx];

      if (!neighbor.visited) {
        neighbor.visited = true;
        const neighborNeighbors = regionQuery(neighborIdx);

        if (neighborNeighbors.length >= minPts) {
          neighbors.push(...neighborNeighbors);
        }
      }

      if (neighbor.clusterId === -1) {
        neighbor.clusterId = clusterId;
      }

      i++;
    }
  }

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    if (point.visited) continue;

    point.visited = true;
    const neighbors = regionQuery(i);

    // neighbors includes the point itself, so we need >= minPts (not < minPts)
    if (neighbors.length < minPts) {
      point.clusterId = -1;
    } else {
      expandCluster(i, neighbors, clusterId);
      clusterId++;
    }
  }

  const clusters: number[][] = [];
  const noise: number[] = [];

  for (let i = 0; i < clusterId; i++) {
    clusters.push([]);
  }

  for (const point of points) {
    if (point.clusterId === -1) {
      noise.push(point.index);
    } else if (point.clusterId !== undefined) {
      clusters[point.clusterId].push(point.index);
    }
  }

  return {
    clusters: clusters.filter(cluster => cluster.length > 0),
    noise
  };
}
