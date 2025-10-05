'use client';

import { useEffect, useState } from 'react';
import { cosineSimilarity } from '@/utils/clustering';

interface Photo {
  id: string;
  path: string;
  filename: string;
  selected: boolean;
}

interface GroupData {
  groups: Photo[][];
  ungrouped: Photo[];
  stats: {
    totalPhotos: number;
    groupCount: number;
    ungroupedCount: number;
    avgGroupSize?: number;
  };
  embeddings?: Array<{
    path: string;
    embedding: number[];
  }>;
}

interface BestPhotoAnalysis {
  bestPhoto: {
    path: string;
    finalScore: number;
    imageQualityScore: number;
    faceQualityScore: number;
    reasoning?: string;
  };
  allPhotos: Array<{
    path: string;
    finalScore: number;
    imageQuality: {
      sharpness: number;
      brightness: number;
      composition: number;
      normalizedScores?: any;
      metrics?: any;
    };
    faceQuality: {
      allEyesOpen: boolean;
      faceCount: number;
      faceScore?: number;
    };
    reasoning?: string;
  }>;
}

export default function ResultsPage() {
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [embeddings, setEmbeddings] = useState<Map<string, number[]>>(new Map());
  const [bestPhotoAnalyses, setBestPhotoAnalyses] = useState<Map<number, BestPhotoAnalysis>>(new Map());
  const [analyzingGroups, setAnalyzingGroups] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Retrieve the group data from sessionStorage
    const storedData = sessionStorage.getItem('photoGroups');
    console.log('🔍 Results page loaded, checking sessionStorage...');
    console.log('   StoredData length:', storedData?.length || 0);
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData) as GroupData;
        console.log('✅ Parsed groupData:', {
          groups: data.groups.length,
          ungrouped: data.ungrouped.length,
          embeddings: data.embeddings?.length || 0,
        });
        setGroupData(data);
        
        // Store embeddings in a map for easy lookup
        if (data.embeddings) {
          const embMap = new Map<string, number[]>();
          data.embeddings.forEach(item => {
            if (item.embedding) {
              embMap.set(item.path, item.embedding);
            }
          });
          setEmbeddings(embMap);
        }
      } catch (error) {
        console.error('❌ Failed to parse groupData:', error);
      }
    } else {
      console.warn('⚠️  No data found in sessionStorage');
    }
  }, []);

  const analyzeGroup = async (groupIndex: number, group: Photo[]) => {
    if (group.length === 1) return; // Skip single photo groups
    
    setAnalyzingGroups(prev => new Set(prev).add(groupIndex));

    try {
      const response = await fetch('/api/select-best-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoPaths: group.map(p => p.path)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error Response:', errorData);
        throw new Error(`Failed to analyze photos: ${errorData.error || response.statusText}`);
      }

      const analysis: BestPhotoAnalysis = await response.json();
      
      setBestPhotoAnalyses(prev => {
        const newMap = new Map(prev);
        newMap.set(groupIndex, analysis);
        return newMap;
      });
    } catch (error) {
      console.error('Error analyzing group:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Error analyzing group ${groupIndex + 1}:\n${errorMessage}`);
    } finally {
      setAnalyzingGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupIndex);
        return newSet;
      });
    }
  };

  const calculateGroupSimilarity = (group: Photo[]): { avgSimilarity: number; minSimilarity: number; maxSimilarity: number } => {
    if (group.length < 2) {
      return { avgSimilarity: 100, minSimilarity: 100, maxSimilarity: 100 };
    }

    const similarities: number[] = [];
    
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const emb1 = embeddings.get(group[i].path);
        const emb2 = embeddings.get(group[j].path);
        
        if (emb1 && emb2) {
          const similarity = cosineSimilarity(emb1, emb2);
          similarities.push(similarity * 100); // Convert to percentage
        }
      }
    }

    if (similarities.length === 0) {
      return { avgSimilarity: 0, minSimilarity: 0, maxSimilarity: 0 };
    }

    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const minSimilarity = Math.min(...similarities);
    const maxSimilarity = Math.max(...similarities);

    return { avgSimilarity, minSimilarity, maxSimilarity };
  };

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Give it a moment to load sessionStorage
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [groupData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-foreground rounded-full animate-spin mx-auto mb-4" />
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  if (!groupData) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-red-600">⚠️ No Data Found</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            No grouping results found. This could happen if:
          </p>
          <ul className="text-left text-sm text-gray-500 dark:text-gray-400 mb-6 list-disc list-inside">
            <li>You navigated here directly without grouping photos first</li>
            <li>SessionStorage was cleared</li>
            <li>The page was opened in a different browser tab</li>
          </ul>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ← Go Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Photo Grouping Results</h1>
        <p className="text-gray-600 dark:text-gray-300">
          CLIP-based similarity grouping using DBSCAN clustering
        </p>
      </header>

      {/* Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8 shadow-md">
        <h2 className="text-xl font-semibold mb-4">Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Photos</p>
            <p className="text-2xl font-bold">{groupData.stats.totalPhotos}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Groups Found</p>
            <p className="text-2xl font-bold text-green-600">{groupData.stats.groupCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ungrouped Photos</p>
            <p className="text-2xl font-bold text-orange-600">{groupData.stats.ungroupedCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Group Size</p>
            <p className="text-2xl font-bold">
              {groupData.stats.avgGroupSize ? groupData.stats.avgGroupSize.toFixed(1) : 'N/A'}
            </p>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p><strong>Parameters:</strong> eps=0.25 (cosine distance threshold), minPts=2</p>
          <p><strong>Model:</strong> CLIP ViT-B/32 (512-dimensional embeddings)</p>
        </div>
      </div>

      {/* Groups */}
      {groupData.groups.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Similar Photo Groups</h2>
          <div className="space-y-6">
            {groupData.groups.map((group, groupIdx) => {
              const { avgSimilarity, minSimilarity, maxSimilarity } = calculateGroupSimilarity(group);
              const bestPhotoAnalysis = bestPhotoAnalyses.get(groupIdx);
              const isAnalyzing = analyzingGroups.has(groupIdx);
              
              return (
                <div key={groupIdx} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">
                      Group {groupIdx + 1} ({group.length} photos)
                    </h3>
                    <div className="flex items-center gap-4">
                      {group.length > 1 && (
                        <div className="text-sm text-right">
                          <p className="text-green-600 font-semibold">
                            Avg Similarity: {avgSimilarity.toFixed(2)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            Range: {minSimilarity.toFixed(2)}% - {maxSimilarity.toFixed(2)}%
                          </p>
                        </div>
                      )}
                      {group.length > 1 && !bestPhotoAnalysis && (
                        <button
                          onClick={() => analyzeGroup(groupIdx, group)}
                          disabled={isAnalyzing}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                        >
                          {isAnalyzing ? 'Analyzing...' : 'Find Best Photo'}
                        </button>
                      )}
                    </div>
                  </div>

                   {bestPhotoAnalysis && (
                     <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                       <p className="font-semibold text-green-800 dark:text-green-200 mb-2">
                         🏆 Best Photo: {group.find(p => p.path === bestPhotoAnalysis.bestPhoto.path)?.filename}
                       </p>
                       <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                         <p>Overall Score: <span className="font-semibold">{bestPhotoAnalysis.bestPhoto.finalScore.toFixed(1)}/100</span></p>
                         <p>Image Quality: <span className="font-semibold">{bestPhotoAnalysis.bestPhoto.imageQualityScore.toFixed(1)}/100</span> (sharpness, brightness, composition)</p>
                         <p>Face Quality: <span className="font-semibold">{bestPhotoAnalysis.bestPhoto.faceQualityScore.toFixed(1)}/100</span> (eyes open, face detection)</p>
                         {bestPhotoAnalysis.bestPhoto.reasoning && (
                           <p className="mt-2 italic text-gray-600 dark:text-gray-400">
                             "{bestPhotoAnalysis.bestPhoto.reasoning}"
                           </p>
                         )}
                       </div>
                     </div>
                   )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {group.map((photo) => {
                      const isBest = bestPhotoAnalysis?.bestPhoto.path === photo.path;
                      const photoAnalysis = bestPhotoAnalysis?.allPhotos.find(p => p.path === photo.path);
                      
                      return (
                        <div key={photo.id} className="relative group/photo">
                          <div className={`aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden ${isBest ? 'ring-4 ring-green-500' : ''}`}>
                            <img
                              src={`/api/direct-image?path=${encodeURIComponent(photo.path)}`}
                              alt={photo.filename}
                              className="w-full h-full object-cover hover:scale-110 transition-transform duration-200"
                            />
                            {isBest && (
                              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                BEST
                              </div>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 truncate" title={photo.filename}>
                            {photo.filename}
                          </p>
                           {photoAnalysis && (
                             <div className="mt-1 text-xs text-gray-500">
                               <p>Score: {photoAnalysis.finalScore.toFixed(1)}</p>
                               <p>Sharpness: {photoAnalysis.imageQuality.sharpness?.toFixed(0) || (photoAnalysis.imageQuality.normalizedScores?.sharpness?.toFixed(0) || 'N/A')}</p>
                               <p>Faces: {photoAnalysis.faceQuality.faceCount || 0} {photoAnalysis.faceQuality.allEyesOpen ? '(eyes open)' : ''}</p>
                             </div>
                           )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ungrouped Photos */}
      {groupData.ungrouped.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Ungrouped Photos</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            These photos didn't match closely enough with any others to form a group.
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupData.ungrouped.map((photo) => (
                <div key={photo.id} className="relative">
                  <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                    <img
                      src={`/api/direct-image?path=${encodeURIComponent(photo.path)}`}
                      alt={photo.filename}
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-200"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 truncate" title={photo.filename}>
                    {photo.filename}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {groupData.groups.length === 0 && groupData.ungrouped.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No photos to display</p>
        </div>
      )}
    </div>
  );
}


