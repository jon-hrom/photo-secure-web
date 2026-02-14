import { useCallback } from 'react';
import BackgroundSettings from './BackgroundSettings';
import CoverSettings from './CoverSettings';
import PhonePreview from './PhonePreview';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface PageDesignSettings {
  coverPhotoId: number | null;
  coverOrientation: 'horizontal' | 'vertical';
  coverFocusX: number;
  coverFocusY: number;
  gridGap: number;
  bgTheme: 'light' | 'dark' | 'auto' | 'custom';
  bgColor: string | null;
  bgImageUrl: string | null;
  bgImageData: string | null;
  bgImageExt: string;
  textColor: string | null;
  coverTextPosition: 'bottom-center' | 'center' | 'bottom-left' | 'bottom-right' | 'top-center';
  coverTitle: string | null;
  coverFontSize: number;
}

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
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 space-y-6 max-h-[65vh] overflow-y-auto pr-1">
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
        />
      </div>
      <PhonePreview
        settings={settings}
        photos={photos}
        folderName={folderName}
      />
    </div>
  );
}
