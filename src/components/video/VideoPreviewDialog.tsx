import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ProfessionalVideoPlayer from './ProfessionalVideoPlayer';

interface VideoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoFile: File | null;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

const VideoPreviewDialog = ({ open, onOpenChange, videoFile, onConfirm, onCancel }: VideoPreviewDialogProps) => {
  const [videoUrl, setVideoUrl] = useState<string>('');

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile]);

  const handleConfirm = () => {
    if (videoFile) {
      onConfirm(videoFile);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Video" size={24} />
            Предпросмотр видео
          </DialogTitle>
        </DialogHeader>

        {videoUrl && (
          <div className="my-4">
            <ProfessionalVideoPlayer src={videoUrl} autoPlay={false} />
          </div>
        )}

        {videoFile && (
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Название: {videoFile.name}</div>
            <div>Размер: {(videoFile.size / 1024 / 1024).toFixed(2)} МБ</div>
            <div>Тип: {videoFile.type}</div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <Icon name="X" className="mr-2" size={16} />
            Отмена
          </Button>
          <Button onClick={handleConfirm}>
            <Icon name="Upload" className="mr-2" size={16} />
            Загрузить на сервер
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VideoPreviewDialog;
