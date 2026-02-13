import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useState } from 'react';
import PhotoGridHeader from './PhotoGridHeader';
import PhotoGridCard from './PhotoGridCard';
import PhotoGridViewer from './PhotoGridViewer';
import PhotoExifDialog from './PhotoExifDialog';
import VideoPlayer from './VideoPlayer';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  is_video?: boolean;
  content_type?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
  tech_reject_reason?: string | null;
  tech_analyzed?: boolean;
  photo_download_count?: number;
}

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
  folder_type?: 'originals' | 'tech_rejects';
  parent_folder_id?: number | null;
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
  onRestorePhoto?: (photoId: number) => void;
  isAdminViewing?: boolean;
  onRenameFolder?: () => void;
  storageUsage?: { usedGb: number; limitGb: number; percent: number };
}

const handleDownload = async (s3Key: string, fileName: string, userId: number) => {
  try {
    console.log('[DOWNLOAD] Starting download:', { s3Key, fileName, userId });
    const response = await fetch(
      `https://functions.poehali.dev/8a60ca41-e494-417e-b881-2ce4f1f4247e?key=${encodeURIComponent(s3Key)}&userId=${userId}`
    );
    console.log('[DOWNLOAD] Download URL response:', response.status);
    
    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }
    
    const data = await response.json();
    console.log('[DOWNLOAD] Pre-signed URL received:', data.url ? 'yes' : 'no');
    
    const fileResponse = await fetch(data.url);
    if (!fileResponse.ok) throw new Error('Failed to fetch file');
    const blob = await fileResponse.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('[DOWNLOAD] Download failed:', error);
    alert('Ошибка при скачивании файла. Попробуйте позже.');
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
  onCancelUpload,
  onRestorePhoto,
  isAdminViewing = false,
  onRenameFolder,
  storageUsage
}: PhotoBankPhotoGridProps) => {
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [exifPhoto, setExifPhoto] = useState<Photo | null>(null);
  const [viewVideo, setViewVideo] = useState<Photo | null>(null);
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handlePhotoClick = (photo: Photo) => {
    if (!selectionMode) {
      if (photo.is_video) {
        setViewVideo(photo);
      } else {
        setViewPhoto(photo);
      }
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

  const isTechRejectsFolder = selectedFolder?.folder_type === 'tech_rejects';
  
  const getRejectionReasonLabel = (reason?: string | null) => {
    const labels: Record<string, string> = {
      blur: 'Размытие',
      overexposed: 'Пересвет',
      underexposed: 'Недосвет',
      noise: 'Шум',
      low_contrast: 'Низкий контраст',
      corrupt_file: 'Поврежденный файл',
      analysis_error: 'Ошибка анализа',
      ok: 'OK'
    };
    return reason ? labels[reason] || reason : 'Неизвестно';
  };

  return (
    <Card>
      <PhotoGridHeader
        selectedFolder={selectedFolder}
        uploading={uploading}
        uploadProgress={uploadProgress}
        isAdminViewing={isAdminViewing}
        onUploadPhoto={onUploadPhoto}
        onCancelUpload={onCancelUpload}
        onRenameFolder={onRenameFolder}
        storageUsage={storageUsage}
      />
      <CardContent>
        {isTechRejectsFolder && photos.length > 0 && (
          <div className="mb-4 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <Icon name="AlertTriangle" size={16} className="sm:w-[18px] sm:h-[18px] flex-shrink-0" />
              <p className="text-xs sm:text-sm font-medium">
                Папка с техническим браком ({photos.length} фото)
              </p>
            </div>
            <p className="text-[10px] sm:text-xs text-red-600 mt-1">
              Эти фото автоматически определены как технический брак. Вы можете восстановить их в оригиналы.
            </p>
          </div>
        )}

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
            {!isTechRejectsFolder && <p className="text-sm mt-2">Загрузите фото, чтобы начать работу</p>}
          </div>
        )}

        {!loading && photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3 md:gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative">
                <PhotoGridCard
                  photo={photo}
                  selectionMode={selectionMode}
                  isSelected={selectedPhotos.has(photo.id)}
                  emailVerified={emailVerified}
                  isAdminViewing={isAdminViewing}
                  onPhotoClick={handlePhotoClick}
                  onDownload={handleDownload}
                  onDeletePhoto={onDeletePhoto}
                  onShowExif={(photo) => setExifPhoto(photo)}
                />
                {isTechRejectsFolder && photo.tech_reject_reason && (
                  <div className="mt-1 space-y-1">
                    <div className="text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 bg-red-100 text-red-700 rounded text-center truncate" title={getRejectionReasonLabel(photo.tech_reject_reason)}>
                      {getRejectionReasonLabel(photo.tech_reject_reason)}
                    </div>
                    {onRestorePhoto && (
                      <button
                        onClick={() => onRestorePhoto(photo.id)}
                        className="w-full text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-700 rounded transition-colors flex items-center justify-center gap-1 touch-manipulation"
                      >
                        <Icon name="RotateCcw" size={12} />
                        <span className="hidden xs:inline">Восстановить</span>
                        <span className="xs:hidden">↻</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <PhotoGridViewer
        viewPhoto={viewPhoto}
        photos={photos}
        onClose={() => setViewPhoto(null)}
        onNavigate={handleNavigate}
        onDownload={handleDownload}
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

      {viewVideo && (
        <VideoPlayer
          src={viewVideo.s3_url || ''}
          poster={viewVideo.thumbnail_s3_url}
          fileName={viewVideo.file_name}
          onClose={() => setViewVideo(null)}
        />
      )}
    </Card>
  );
};

export default PhotoBankPhotoGrid;