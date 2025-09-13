import { useState, useEffect, useRef } from 'react';

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
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Keep current thumbnail centered in preview pane
  useEffect(() => {
    if (previewContainerRef.current) {
      const container = previewContainerRef.current;
      const thumbnailWidth = 72; // w-[4.5rem]
      const gap = 4; // gap-1
      const scrollPosition = (thumbnailWidth + gap) * currentIndex;
      const centerOffset = (container.clientWidth - thumbnailWidth) / 2;
      
      container.scrollTo({
        left: scrollPosition - centerOffset,
        behavior: 'smooth'
      });
    }
  }, [currentIndex]);

  // Add keyboard navigation
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      // Only handle keyboard events if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (currentIndex > 0) {
            onPrevious();
          }
          break;
        case 'ArrowRight':
          if (currentIndex < photos.length - 1) {
            onNext();
          }
          break;
        case ' ': // Spacebar
          e.preventDefault(); // Prevent page scroll
          if (currentPhoto) {
            onSelect(currentPhoto.id, !currentPhoto.selected);
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, photos.length, currentPhoto, onNext, onPrevious, onSelect]);
  
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
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative flex-1 flex items-center justify-center min-h-0">
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
        <div className="flex items-center gap-4">
          <p className="text-sm">
            {currentIndex + 1} of {photos.length}: {currentPhoto.filename}
          </p>
          <div className="text-xs text-gray-500 dark:text-gray-400">
          </div>
        </div>
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
      
      {/* Preview slider */}
      <div className="relative h-24 w-[360px] mx-auto bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-gray-100 dark:from-gray-800 to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-gray-100 dark:from-gray-800 to-transparent z-10" />
        
        <div className="flex gap-1 items-center absolute inset-y-0 left-1 z-20">
          <button
            onClick={onPrevious}
            disabled={currentIndex === 0}
            className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-xs"
          >
            ←
          </button>
        </div>
        
        <div className="flex gap-1 items-center absolute inset-y-0 right-1 z-20">
          <button
            onClick={onNext}
            disabled={currentIndex === photos.length - 1}
            className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-xs"
          >
            →
          </button>
        </div>

        <div 
          ref={previewContainerRef}
          className="flex gap-1 p-1 overflow-x-auto hide-scrollbar h-full"
          style={{
            scrollBehavior: 'smooth',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none'
          }}
        >
          {photos.map((photo, index) => {
            // Only render previews for current photo and 2 photos before/after
            const shouldRender = Math.abs(index - currentIndex) <= 2;
            
            return (
              <button
                key={photo.id}
                onClick={() => {
                  const newIndex = index;
                  if (newIndex !== currentIndex) {
                    if (newIndex > currentIndex) {
                      onNext();
                    } else {
                      onPrevious();
                    }
                  }
                }}
                className={`relative flex-shrink-0 w-[4.5rem] h-[4.5rem] rounded-md overflow-hidden transition-all duration-200 ${
                  index === currentIndex 
                    ? 'ring-2 ring-blue-500 ring-offset-1 scale-105' 
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  // Use empty div with same dimensions for non-rendered items
                  // to maintain scroll position and spacing
                  visibility: shouldRender ? 'visible' : 'hidden'
                }}
              >
                {shouldRender && (
                  <>
                    <img
                      src={`/api/direct-image?path=${encodeURIComponent(photo.path)}&preview=true`}
                      alt={photo.filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {photo.selected && (
                      <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full" />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
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