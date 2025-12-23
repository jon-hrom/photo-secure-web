import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface VideoUploadButtonProps {
  isUploading: boolean;
  uploadProgress: number;
  compressionInfo: string;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const VideoUploadButton = ({
  isUploading,
  uploadProgress,
  compressionInfo,
  onFileSelect
}: VideoUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={onFileSelect}
        className="hidden"
      />
      
      <Button
        variant="outline"
        className="w-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
            Обработка...
          </>
        ) : (
          <>
            <Icon name="Upload" size={16} className="mr-2" />
            Загрузить видео
          </>
        )}
      </Button>

      {isUploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} className="w-full" />
          {compressionInfo && (
            <p className="text-xs text-muted-foreground text-center">
              {compressionInfo}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoUploadButton;
