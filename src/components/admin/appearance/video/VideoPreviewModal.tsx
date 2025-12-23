import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface VideoPreviewModalProps {
  previewVideo: string;
  previewFile: File;
  isUploading: boolean;
  isMobileVersion?: boolean;
  onCancel: () => void;
  onConfirm: (isMobile?: boolean) => void;
}

const VideoPreviewModal = ({
  previewVideo,
  previewFile,
  isUploading,
  isMobileVersion = false,
  onCancel,
  onConfirm
}: VideoPreviewModalProps) => {
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isMobileVersion ? 'Мобильная версия видео' : 'Предпросмотр видео'}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
          >
            <Icon name="X" size={20} />
          </Button>
        </div>
        
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={previewVideoRef}
            src={previewVideo}
            controls
            autoPlay
            loop
            className="w-full h-full object-contain"
          />
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>Размер: {(previewFile.size / 1024 / 1024).toFixed(1)} MB</p>
          {isMobileVersion ? (
            <p className="mt-1">✅ Рекомендуем сжатое видео 720p для быстрой загрузки на телефонах</p>
          ) : (
            <p className="mt-1">Видео будет загружено в облачное хранилище и доступно через CDN</p>
          )}
        </div>
        
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Отмена
          </Button>
          {!isMobileVersion && (
            <Button
              variant="outline"
              onClick={() => onConfirm(true)}
              disabled={isUploading}
            >
              <Icon name="Smartphone" size={16} className="mr-2" />
              Загрузить как мобильную версию
            </Button>
          )}
          <Button
            onClick={() => onConfirm(isMobileVersion)}
            disabled={isUploading}
          >
            {isUploading ? 'Загрузка...' : 'Загрузить видео'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoPreviewModal;