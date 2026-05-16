import { useCallback, useState } from 'react';
import BackgroundSettings from './BackgroundSettings';
import CoverSettings from './CoverSettings';
import PhonePreview from './PhonePreview';
import { Photo, PageDesignSettings } from './cover/types';

export type PreviewMode = 'desktop' | 'mobile';

interface PageDesignTabProps {
  folderId: number;
  folderName: string;
  userId: number;
  photos: Photo[];
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
}

export default function PageDesignTab({ 
  folderId,
  folderName,
  userId,
  photos,
  settings, 
  onSettingsChange 
}: PageDesignTabProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');

  const extractDominantColor = useCallback((photo: Photo): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve('#2d2d3a'); return; }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
        }
        r = Math.round(r / count * 0.6);
        g = Math.round(g / count * 0.6);
        b = Math.round(b / count * 0.6);
        resolve(`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`);
      };
      img.onerror = () => resolve('#2d2d3a');
      img.src = photo.thumbnail_url || photo.photo_url;
    });
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 min-w-0 space-y-8 max-h-[75vh] overflow-y-auto pr-2">
        <BackgroundSettings
          settings={settings}
          onSettingsChange={onSettingsChange}
          photos={photos}
          extractDominantColor={extractDominantColor}
        />
        <CoverSettings
          settings={settings}
          onSettingsChange={onSettingsChange}
          photos={photos}
          folderName={folderName}
          extractDominantColor={extractDominantColor}
          onModeChange={setPreviewMode}
          previewMode={previewMode}
        />
      </div>
      <div className="lg:sticky lg:top-0 lg:self-start">
        <PhonePreview
          settings={settings}
          photos={photos}
          folderName={folderName}
          previewMode={previewMode}
          onModeChange={setPreviewMode}
        />
      </div>
    </div>
  );
}