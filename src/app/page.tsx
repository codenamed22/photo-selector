'use client';

import { useState, useEffect } from 'react';
import FolderSelector from '@/components/FolderSelector';
import PhotoViewer from '@/components/PhotoViewer';

interface Photo {
  id: string;
  path: string;
  filename: string;
  selected: boolean;
}

export default function Home() {
  const [isScanning, setIsScanning] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [outputFolder, setOutputFolder] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const handleFolderSelected = async (folderPath: string) => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/scan-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scan folder');
      }

      const data = await response.json();
      setPhotos(data.photos || []);
      setSelectedFolder(folderPath);
      setOutputFolder(`${folderPath}/selected`);
    } catch (error) {
      console.error('Error scanning folder:', error);
      alert(`Error scanning folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectPhoto = (id: string, selected: boolean) => {
    setPhotos(photos.map(photo => 
      photo.id === id ? { ...photo, selected } : photo
    ));
  };

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSaveSelected = async () => {
    const selectedPhotos = photos.filter(photo => photo.selected);
    
    try {
      const response = await fetch('/api/copy-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: selectedPhotos.map(photo => photo.path),
          destinationFolder: outputFolder,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to copy files');
      }

      const result = await response.json();
      alert(`Successfully copied ${result.copied} files to ${outputFolder}`);
    } catch (error) {
      console.error('Error copying files:', error);
      alert(`Error copying files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAiSelect = async () => {
    if (photos.length === 0) return;
    
    setIsAiProcessing(true);
    
    try {
      // 1. Group similar photos
      const similarGroups = await groupSimilarPhotos(photos);
      
      // 2. For each group, select the best photo
      const bestPhotos = await selectBestFromGroups(similarGroups);
      
      // 3. Update the selection state
      const updatedPhotos = [...photos];
      
      // Reset all selections first
      updatedPhotos.forEach(photo => photo.selected = false);
      
      // Then select the best photos
      bestPhotos.forEach(bestPhotoId => {
        const photoIndex = updatedPhotos.findIndex(p => p.id === bestPhotoId);
        if (photoIndex !== -1) {
          updatedPhotos[photoIndex].selected = true;
        }
      });
      
      setPhotos(updatedPhotos);
      
    } catch (error) {
      console.error('Error in AI selection:', error);
      alert(`Error selecting photos with AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAiProcessing(false);
    }
  };
  
  // Add helper functions for similar photo grouping and AI selection
  
  // Function to group similar photos
  const groupSimilarPhotos = async (photos: Photo[]) => {
    // For initial implementation, we'll group by simple filename pattern
    // In a real app, you might use image similarity, timestamps, or other methods
    
    const groups = [];
    const processed = new Set();
    
    for (const photo of photos) {
      if (processed.has(photo.id)) continue;
      
      // Create a new group with this photo
      const group = [photo];
      processed.add(photo.id);
      
      // Find similar photos (simple implementation based on filename)
      const baseFilename = photo.filename.replace(/\.\w+$/, ''); // Remove extension
      const pattern = new RegExp(`^${baseFilename}.*\\d+\\.(jpg|jpeg|png)$`, 'i');
      
      // Find similar photos and add to group
      for (const otherPhoto of photos) {
        if (!processed.has(otherPhoto.id) && 
            (otherPhoto.filename.match(pattern) || 
             // Also check for very similar filenames (e.g., IMG_1234 and IMG_1235)
             isSimilarFilename(photo.filename, otherPhoto.filename))) {
          group.push(otherPhoto);
          processed.add(otherPhoto.id);
        }
      }
      
      if (group.length > 0) {
        groups.push(group);
      }
    }
    
    return groups;
  };
  
  // Helper function to check if filenames are similar
  const isSimilarFilename = (file1: string, file2: string) => {
    // Strip extensions
    const name1 = file1.replace(/\.\w+$/, '');
    const name2 = file2.replace(/\.\w+$/, '');
    
    // If they have the same prefix but different numbers at the end
    const prefix1 = name1.replace(/\d+$/, '');
    const prefix2 = name2.replace(/\d+$/, '');
    
    if (prefix1 === prefix2 && prefix1.length > 0) {
      // Check if the numeric suffixes are close to each other
      const num1 = parseInt(name1.match(/\d+$/)?.[0] || '0', 10);
      const num2 = parseInt(name2.match(/\d+$/)?.[0] || '0', 10);
      
      return Math.abs(num1 - num2) <= 5; // Consider sequential photos as similar
    }
    
    return false;
  };
  
  // Function to select the best photo from each group
  const selectBestFromGroups = async (groups: Photo[][]) => {
    const bestPhotoIds = [];
    
    // For each group, we need to select the best photo
    for (const group of groups) {
      if (group.length === 1) {
        // If there's only one photo in the group, select it
        bestPhotoIds.push(group[0].id);
      } else {
        // For multiple photos, we'll use AI to select the best one
        const bestPhoto = await selectBestPhoto(group);
        bestPhotoIds.push(bestPhoto.id);
      }
    }
    
    return bestPhotoIds;
  };
  
  // Function to select the best photo using AI
  const selectBestPhoto = async (photos : Photo[]) => {
    // TODO: Integrate with an actual AI service
    // For now, we'll use a placeholder that picks the "best" photo based on simple criteria
    
    // Placeholder: Sort by filename and pick the last one
    // In a real implementation, this would call an AI service
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simple placeholder algorithm - in production replace with AI API call
    return photos.reduce((best: any, current: Photo) => {
      // This is just a placeholder. In real implementation, we'd score based on AI analysis
      const score = Math.random(); // Random score for demo purposes
      
      if (!best || score > best.score) {
        return { ...current, score };
      }
      return best;
    }, null);
  };

  return (
    <div className="flex flex-col min-h-screen p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Photo Selector</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Select and organize your photos
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center gap-8">
        <FolderSelector 
          onFolderSelected={handleFolderSelected} 
          isLoading={isScanning} 
        />
        
        {photos.length > 0 && (
          <>
            <PhotoViewer
              photos={photos}
              currentIndex={currentIndex}
              onSelect={handleSelectPhoto}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onAiSelect={handleAiSelect}
              isAiProcessing={isAiProcessing}
            />
            
            <div className="w-full max-w-3xl mt-8">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Selected: {photos.filter(p => p.selected).length} of {photos.length}</p>
                  <p className="text-sm text-gray-500">Output folder: {outputFolder}</p>
                </div>
                <button
                  onClick={handleSaveSelected}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  disabled={!photos.some(p => p.selected)}
                >
                  Save Selected Photos
                </button>
              </div>
            </div>
          </>
        )}
        
        {isScanning && (
          <div className="text-center">
            <p>Scanning folder for photos...</p>
          </div>
        )}
        
        {!isScanning && photos.length === 0 && selectedFolder && (
          <div className="text-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p>No photos found in the selected folder.</p>
          </div>
        )}
      </main>
    </div>
  );
}