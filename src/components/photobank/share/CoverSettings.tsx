import { useMemo } from 'react';
import CoverPreviewDesktop from './cover/CoverPreviewDesktop';
import CoverControlsPanel from './cover/CoverControlsPanel';
import CoverPreviewMobile from './cover/CoverPreviewMobile';
import CoverPhotoSelector from './cover/CoverPhotoSelector';
import { Photo, PageDesignSettings } from './cover/types';
import { PreviewMode } from './PageDesignTab';

interface CoverSettingsProps {
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
  photos: Photo[];
  folderName: string;
  extractDominantColor: (photo: Photo) => Promise<string>;
  onModeChange?: (mode: PreviewMode) => void;
  previewMode?: PreviewMode;
}

export default function CoverSettings({
  settings,
  onSettingsChange,
  photos,
  folderName,
  extractDominantColor,
  onModeChange,
  previewMode,
}: CoverSettingsProps) {
  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) =>
      (a.file_name || '').localeCompare(b.file_name || '', 'ru', { numeric: true, sensitivity: 'base' })
    );
  }, [photos]);

  const coverPhoto = photos.find(p => p.id === settings.coverPhotoId) || sortedPhotos[0] || null;
  const mobileCoverPhoto = photos.find(p => p.id === settings.mobileCoverPhotoId) || coverPhoto;

  const handleSelectCoverPhoto = (photoId: number) => {
    onSettingsChange({ ...settings, coverPhotoId: photoId });
    if (settings.bgTheme === 'auto') {
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        extractDominantColor(photo).then(color => {
          onSettingsChange({ ...settings, coverPhotoId: photoId, bgColor: color });
        });
      }
    }
  };

  const handleSelectMobileCoverPhoto = (photoId: number) => {
    onSettingsChange({ ...settings, mobileCoverPhotoId: photoId });
  };

  const effectiveMobileSelectedId = settings.mobileCoverPhotoId
    ? settings.mobileCoverPhotoId
    : (settings.coverPhotoId || sortedPhotos[0]?.id || null);

  const desktopRingClass = previewMode === 'desktop'
    ? 'rounded-xl p-3 border-2 border-blue-500/50 cursor-pointer'
    : 'rounded-xl p-3 border-2 border-transparent cursor-pointer';
  const mobileRingClass = previewMode === 'mobile'
    ? 'rounded-xl p-3 border-2 border-green-500/50 cursor-pointer'
    : 'rounded-xl p-3 border-2 border-transparent cursor-pointer';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <div
          className={`${desktopRingClass} flex flex-col`}
          onClick={() => onModeChange?.('desktop')}
          onFocusCapture={() => onModeChange?.('desktop')}
          style={{ minWidth: 0 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Web-обложка</h3>
          </div>
          <div className="flex-1 flex flex-col">
            <CoverPreviewDesktop
              settings={settings}
              onSettingsChange={onSettingsChange}
              coverPhoto={coverPhoto}
              folderName={folderName}
            />
          </div>

          <div className="mt-auto pt-5">
            <CoverPhotoSelector
              title="Фото для web-обложки"
              photos={sortedPhotos}
              selectedPhotoId={settings.coverPhotoId}
              onSelect={handleSelectCoverPhoto}
              accentColor="blue"
            />
          </div>
        </div>

        <div
          className={`${mobileRingClass} flex flex-col`}
          onClick={() => onModeChange?.('mobile')}
          onFocusCapture={() => onModeChange?.('mobile')}
          style={{ minWidth: 0 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Mobile-обложка</h3>
          </div>
          <div className="flex-1 flex flex-col">
            <CoverPreviewMobile
              settings={settings}
              onSettingsChange={onSettingsChange}
              mobileCoverPhoto={mobileCoverPhoto}
              folderName={folderName}
            />
          </div>

          <div className="mt-auto pt-5">
            <CoverPhotoSelector
              title="Фото для mobile-обложки"
              subtitle="Если не выбрано — используется web-обложка"
              photos={sortedPhotos}
              selectedPhotoId={effectiveMobileSelectedId}
              onSelect={handleSelectMobileCoverPhoto}
              accentColor="green"
            />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4 mt-4">
          Общие настройки обложки
        </h4>
        <CoverControlsPanel
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      </div>
    </div>
  );
}