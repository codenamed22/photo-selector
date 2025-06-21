import { useState, useEffect } from 'react';

interface Photo {
  id: string;
  path: string;
  filename: string;
  selected: boolean;
}

interface PhotoViewerProps {
  photos: Photo[];
  currentIndex: number;
  onSelect: (id: string, selected: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  onAiSelect?: () => Promise<void>; // New prop for AI selection
  isAiProcessing?: boolean; // Flag to indicate AI processing state
}

export default function PhotoViewer({
  photos,
  currentIndex,
  onSelect,
  onNext,
  onPrevious,
  onAiSelect,
  isAiProcessing = false
}: PhotoViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const currentPhoto = photos[currentIndex];
  
  // Fetch image data when current photo changes
  useEffect(() => {
    let isMounted = true;
    
    async function loadImage() {
      if (!currentPhoto) return;
      
      setIsLoading(true);
      setImageError(false);
      setImageData(null);
      
      try {
        const encodedPath = encodeURIComponent(currentPhoto.path);
        const url = `/api/image?path=${encodedPath}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const responseText = await response.text();
        
        // Parse as JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error('Invalid response format from server');
        }
        
        // Handle case when image is too large
        if (data.tooLarge) {
          // Use the direct URL approach instead
          if (isMounted) {
            setImageData(`direct:${data.directUrl}`);
            setIsLoading(false);
          }
          return;
        }

        if (data.error) {
          throw new Error(data.error);
        }
        
        if (!data.data) {
          throw new Error('No image data received');
        }
        
        if (isMounted) {
          setImageData(data.data);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setImageError(true);
          setIsLoading(false);
        }
      }
    }
    
    loadImage();
    
    return () => {
      isMounted = false;
    };
  }, [currentPhoto]);
  
  // Set up direct image URL as fallback
  const directImageUrl = currentPhoto ? `/api/direct-image?path=${encodeURIComponent(currentPhoto.path)}` : '';

  if (!currentPhoto) {
    return <div className="text-center p-8">No photos to display</div>;
  }

  return (
    <div className="flex flex-col gap-4 w-[75vw] h-[75vh] max-w-none mx-auto">
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative flex-1 flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-foreground rounded-full animate-spin" />
          </div>
        )}
        
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-red-500">Failed to load image</p>
          </div>
        )}
        
        {imageData && !isLoading && !imageError && (
          <>
            {/* For normal sized images (base64) */}
            {!imageData.startsWith('direct:') && (
              <img
                src={imageData}
                alt={currentPhoto.filename}
                className="w-full h-full object-contain"
                style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
                onError={() => setImageError(true)}
              />
            )}
            
            {/* For oversized images (direct URL) */}
            {imageData.startsWith('direct:') && (
              <img
                src={imageData.substring(7)} // Remove the 'direct:' prefix
                alt={currentPhoto.filename}
                className="w-full h-full object-contain"
                onError={() => setImageError(true)}
              />
            )}
            {/* View Full Size Button */}
            <button
              className="absolute top-2 right-2 bg-white bg-opacity-80 px-3 py-1 rounded shadow text-sm font-semibold hover:bg-opacity-100"
              onClick={() => window.open(`/api/direct-image?path=${encodeURIComponent(currentPhoto.path)}`, '_blank')}
              type="button"
            >
              View Full Size
            </button>
          </>
        )}

        {!imageData && !isLoading && (
          <img
            src={directImageUrl}
            alt={currentPhoto?.filename || 'Photo'}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        )}
      </div>
      
      <div className="flex justify-between items-center">
        <p className="text-sm">
          {currentIndex + 1} of {photos.length}: {currentPhoto.filename}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onSelect(currentPhoto.id, !currentPhoto.selected)}
            className={`px-4 py-2 rounded-md ${
              currentPhoto.selected 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            {currentPhoto.selected ? 'Selected' : 'Select'}
          </button>
        </div>
      </div>
      
      <div className="flex justify-between mt-4">
        <button
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className="px-4 py-2 bg-foreground text-background rounded-md hover:opacity-90 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={currentIndex === photos.length - 1}
          className="px-4 py-2 bg-foreground text-background rounded-md hover:opacity-90 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Zoom controls */}
      <div className="flex gap-2 mt-2 justify-center">
        <button
          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
          type="button"
        >
          -
        </button>
        <span className="px-2">{Math.round(zoom * 100)}%</span>
        <button
          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          onClick={() => setZoom(z => Math.min(3, z + 0.1))}
          type="button"
        >
          +
        </button>
      </div>

      {/* Add AI Selection button */}
      <button
        className="mt-4 w-full py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center justify-center gap-2"
        onClick={onAiSelect}
        disabled={isAiProcessing || !onAiSelect}
      >
        {isAiProcessing ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            AI Processing Photos...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
            Select Best Photos with AI
          </>
        )}
      </button>
    </div>
  );
}