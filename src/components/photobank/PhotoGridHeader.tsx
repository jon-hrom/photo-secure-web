import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface PhotoGridHeaderProps {
  selectedFolder: PhotoFolder | null;
  uploading: boolean;
  uploadProgress: { current: number; total: number; percent: number; currentFileName: string };
  onUploadPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancelUpload: () => void;
  isAdminViewing?: boolean;
}

const PhotoGridHeader = ({
  selectedFolder,
  uploading,
  uploadProgress,
  onUploadPhoto,
  onCancelUpload,
  isAdminViewing = false
}: PhotoGridHeaderProps) => {
  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Icon name="Image" size={20} />
          {selectedFolder ? selectedFolder.folder_name : 'Фотографии'}
        </CardTitle>
        {selectedFolder && !isAdminViewing && (
          <div className="relative">
            <input
              type="file"
              id="photo-upload"
              className="hidden"
              accept="image/*,video/*,.raw,.cr2,.nef,.arw,.dng"
              multiple
              onChange={onUploadPhoto}
              disabled={uploading}
            />
            <Button asChild disabled={uploading} size="sm">
              <label htmlFor="photo-upload" className="cursor-pointer">
                <Icon name="Upload" className="mr-2" size={16} />
                {uploading ? 'Загрузка...' : 'Загрузить медиа'}
              </label>
            </Button>
          </div>
        )}
      </div>

      {uploading && uploadProgress.total > 0 && (
        <div className="mt-4 space-y-3 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Icon name="Loader2" size={20} className="animate-spin text-primary" />
                <div className="absolute inset-0 animate-ping opacity-25">
                  <Icon name="Loader2" size={20} className="text-primary" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">
                  Загружается {uploadProgress.current} из {uploadProgress.total}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                  {uploadProgress.currentFileName}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onCancelUpload}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Icon name="X" size={16} className="mr-1" />
              Отменить
            </Button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{uploadProgress.percent}%</span>
              <span>{uploadProgress.current} / {uploadProgress.total}</span>
            </div>
            <div className="relative h-2 bg-primary/10 rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress.percent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      )}
    </CardHeader>
  );
};

export default PhotoGridHeader;