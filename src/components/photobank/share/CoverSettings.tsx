import CoverPreviewDesktop from './cover/CoverPreviewDesktop';
import CoverControlsPanel from './cover/CoverControlsPanel';
import CoverPreviewMobile from './cover/CoverPreviewMobile';
import CoverPhotoSelector from './cover/CoverPhotoSelector';
import { Photo, PageDesignSettings } from './cover/types';

interface CoverSettingsProps {
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
  photos: Photo[];
  folderName: string;
  extractDominantColor: (photo: Photo) => Promise<string>;
}

export default function CoverSettings({
  settings,
  onSettingsChange,
  photos,
  folderName,
  extractDominantColor
}: CoverSettingsProps) {
  const coverPhoto = photos.find(p => p.id === settings.coverPhotoId) || photos[0] || null;
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
    : (settings.coverPhotoId || photos[0]?.id || null);

  return (
    <>
      <CoverPreviewDesktop
        settings={settings}
        onSettingsChange={onSettingsChange}
        coverPhoto={coverPhoto}
        folderName={folderName}
      />

      <CoverControlsPanel
        settings={settings}
        onSettingsChange={onSettingsChange}
      />

      <CoverPreviewMobile
        settings={settings}
        onSettingsChange={onSettingsChange}
        mobileCoverPhoto={mobileCoverPhoto}
        folderName={folderName}
      />

      <CoverPhotoSelector
        title="Фото для web-обложки"
        photos={photos}
        selectedPhotoId={settings.coverPhotoId}
        onSelect={handleSelectCoverPhoto}
        accentColor="blue"
      />

      <CoverPhotoSelector
        title="Фото для mobile-обложки"
        subtitle="Если не выбрано — используется web-обложка"
        photos={photos}
        selectedPhotoId={effectiveMobileSelectedId}
        onSelect={handleSelectMobileCoverPhoto}
        accentColor="green"
      />
    </>
  );
}
