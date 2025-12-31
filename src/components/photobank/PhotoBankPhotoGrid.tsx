import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useState } from 'react';
import PhotoGridHeader from './PhotoGridHeader';
import PhotoGridCard from './PhotoGridCard';
import PhotoGridViewer from './PhotoGridViewer';
import PhotoExifDialog from './PhotoExifDialog';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface PhotoBankPhotoGridProps {
  selectedFolder: PhotoFolder | null;
  photos: Photo[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: { current: number; total: number; percent: number; currentFileName: string };
  selectionMode: boolean;
  selectedPhotos: Set<number>;
  emailVerified: boolean;
  onUploadPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeletePhoto: (photoId: number, fileName: string) => void;
  onTogglePhotoSelection: (photoId: number) => void;
  onCancelUpload: () => void;
}

const handleDownload = async (url: string, fileName: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Download failed:', error);
  }
};

const PhotoBankPhotoGrid = ({
  selectedFolder,
  photos,
  loading,
  uploading,
  uploadProgress,
  selectionMode,
  selectedPhotos,
  emailVerified,
  onUploadPhoto,
  onDeletePhoto,
  onTogglePhotoSelection,
  onCancelUpload
}: PhotoBankPhotoGridProps) => {
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [exifPhoto, setExifPhoto] = useState<Photo | null>(null);
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handlePhotoClick = (photo: Photo) => {
    if (!selectionMode) {
      setViewPhoto(photo);
    } else {
      onTogglePhotoSelection(photo.id);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!viewPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === viewPhoto.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < photos.length) {
      setViewPhoto(photos[newIndex]);
    }
  };

  return (
    <Card>
      <PhotoGridHeader
        selectedFolder={selectedFolder}
        uploading={uploading}
        uploadProgress={uploadProgress}
        onUploadPhoto={onUploadPhoto}
        onCancelUpload={onCancelUpload}
      />
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && !selectedFolder && (
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="FolderOpen" size={48} className="mx-auto mb-4 opacity-50" />
            <p>Выберите папку для просмотра фотографий</p>
          </div>
        )}

        {!loading && selectedFolder && photos.length === 0 && !uploading && (
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="ImageOff" size={48} className="mx-auto mb-4 opacity-50" />
            <p>В этой папке пока нет фотографий</p>
            <p className="text-sm mt-2">Загрузите фото, чтобы начать работу</p>
          </div>
        )}

        {!loading && photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {photos.map((photo) => (
              <PhotoGridCard
                key={photo.id}
                photo={photo}
                selectionMode={selectionMode}
                isSelected={selectedPhotos.has(photo.id)}
                emailVerified={emailVerified}
                onPhotoClick={handlePhotoClick}
                onDownload={handleDownload}
                onDeletePhoto={onDeletePhoto}
                onShowExif={(photo) => setExifPhoto(photo)}
              />
            ))}
          </div>
        )}
      </CardContent>

      <PhotoGridViewer
        viewPhoto={viewPhoto}
        photos={photos}
        onClose={() => setViewPhoto(null)}
        onNavigate={handleNavigate}
        formatBytes={formatBytes}
      />

      {exifPhoto && (
        <PhotoExifDialog
          open={!!exifPhoto}
          onOpenChange={(open) => !open && setExifPhoto(null)}
          s3Key={exifPhoto.s3_key || ''}
          fileName={exifPhoto.file_name}
          photoUrl={exifPhoto.thumbnail_s3_url || exifPhoto.s3_url || exifPhoto.data_url}
        />
      )}
    </Card>
  );
};

export default PhotoBankPhotoGrid;