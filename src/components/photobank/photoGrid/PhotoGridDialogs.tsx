import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PhotoGridViewer from '../PhotoGridViewer';
import PhotoExifDialog from '../PhotoExifDialog';
import VideoPlayer from '../VideoPlayer';
import { Photo, handleDownload, formatBytes } from './photoGridTypes';

interface PhotoGridDialogsProps {
  viewPhoto: Photo | null;
  sortedPhotos: Photo[];
  onCloseViewer: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  exifPhoto: Photo | null;
  setExifPhoto: (photo: Photo | null) => void;
  viewVideo: Photo | null;
  setViewVideo: (photo: Photo | null) => void;
  posterPhoto: Photo | null;
  setPosterPhoto: (photo: Photo | null) => void;
  posterBusy: boolean;
  posterFileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onPosterFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetPoster: () => void;
}

const PhotoGridDialogs = ({
  viewPhoto,
  sortedPhotos,
  onCloseViewer,
  onNavigate,
  exifPhoto,
  setExifPhoto,
  viewVideo,
  setViewVideo,
  posterPhoto,
  setPosterPhoto,
  posterBusy,
  posterFileInputRef,
  onPosterFileSelected,
  onResetPoster,
}: PhotoGridDialogsProps) => {
  return (
    <>
      <PhotoGridViewer
        viewPhoto={viewPhoto}
        photos={sortedPhotos}
        onClose={onCloseViewer}
        onNavigate={onNavigate}
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
          photo={exifPhoto}
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

      <input
        ref={posterFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPosterFileSelected}
      />

      <Dialog open={!!posterPhoto} onOpenChange={(open) => !open && !posterBusy && setPosterPhoto(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Обложка видео</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {posterPhoto?.thumbnail_s3_url ? (
              <img
                src={posterPhoto.thumbnail_s3_url}
                alt="Текущая обложка"
                className="w-full rounded-lg object-contain max-h-48 bg-muted"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Сейчас обложка берётся из первого кадра видео. Можно загрузить свою картинку.
              </p>
            )}
            <Button
              className="w-full"
              disabled={posterBusy}
              onClick={() => posterFileInputRef.current?.click()}
            >
              {posterBusy ? (
                <Icon name="Loader2" size={16} className="animate-spin mr-2" />
              ) : (
                <Icon name="Upload" size={16} className="mr-2" />
              )}
              Загрузить свою картинку
            </Button>
            {posterPhoto?.thumbnail_s3_url && (
              <Button
                variant="outline"
                className="w-full"
                disabled={posterBusy}
                onClick={onResetPoster}
              >
                <Icon name="RotateCcw" size={16} className="mr-2" />
                Сбросить на первый кадр
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PhotoGridDialogs;
