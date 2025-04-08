import { useState } from 'react';

interface FolderSelectorProps {
  onFolderSelected: (path: string) => void;
  isLoading: boolean;
}

export default function FolderSelector({ onFolderSelected, isLoading }: FolderSelectorProps) {
  const [folderPath, setFolderPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderPath.trim()) {
      onFolderSelected(folderPath);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="flex flex-col gap-2">
        <label htmlFor="folder-path" className="font-medium">
          Enter folder path to scan photos
        </label>
        <div className="flex gap-2">
          <input
            id="folder-path"
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="C:\Users\Photos"
            className="flex-1 px-3 py-2 border rounded-md"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-foreground text-background rounded-md hover:opacity-90 disabled:opacity-50"
            disabled={isLoading || !folderPath.trim()}
          >
            {isLoading ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      </div>
    </form>
  );
}