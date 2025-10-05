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

  const handleGroupPhotos = async () => {
    if (photos.length === 0) return;
    
    setIsAiProcessing(true);
    
    try {
      const minPts = photos.length <= 3 ? 1 : 2;
      
      const response = await fetch('/api/group-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos, eps: 0.25, minPts }),
      });
      
      if (!response.ok) throw new Error('Failed to group photos');
      
      const groupData = await response.json();
      sessionStorage.setItem('photoGroups', JSON.stringify(groupData));
      window.open('/results', '_blank');
      
    } catch (error) {
      alert(`Error grouping photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAiProcessing(false);
    }
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
              onAiSelect={handleGroupPhotos}
              isAiProcessing={isAiProcessing}
            />
            
            <div className="w-full max-w-3xl mt-8">
              <p className="font-medium text-center">
                Viewing {photos.length} photo{photos.length !== 1 ? 's' : ''} from {selectedFolder}
              </p>
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