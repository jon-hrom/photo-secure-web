import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
  folder_type?: 'originals' | 'tech_rejects' | 'retouch';
  parent_folder_id?: number | null;
  has_password?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
}

interface PhotoGridHeaderProps {
  selectedFolder: PhotoFolder | null;
  uploading: boolean;
  uploadProgress: { current: number; total: number; percent: number; currentFileName: string };
  onUploadPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancelUpload: () => void;
  isAdminViewing?: boolean;
  onRenameFolder?: () => void;
  storageUsage?: { usedGb: number; limitGb: number; percent: number };
  subfolders?: PhotoFolder[];
  onSelectSubfolder?: (subfolder: PhotoFolder) => void;
  onCreateSubfolder?: () => void;
  onOpenSubfolderSettings?: (subfolder: PhotoFolder) => void;
  onDeleteSubfolder?: (subfolder: PhotoFolder) => void;
}

const PhotoGridHeader = ({
  selectedFolder,
  uploading,
  uploadProgress,
  onUploadPhoto,
  onCancelUpload,
  isAdminViewing = false,
  onRenameFolder,
  storageUsage,
  subfolders,
  onSelectSubfolder,
  onCreateSubfolder,
  onOpenSubfolderSettings,
  onDeleteSubfolder
}: PhotoGridHeaderProps) => {
  const isStorageFull = storageUsage && storageUsage.percent >= 100;

  const isUserCreatedSubfolder = (sf: PhotoFolder) => {
    return sf.folder_type === 'originals' && !!sf.parent_folder_id;
  };

  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Icon name="Image" size={20} />
          {selectedFolder ? selectedFolder.folder_name : 'Фотографии'}
          {selectedFolder && onRenameFolder && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRenameFolder}
              className="h-7 w-7 p-0 hover:bg-accent"
              title="Переименовать папку"
            >
              <Icon name="Pencil" size={14} />
            </Button>
          )}
        </CardTitle>
        {selectedFolder && (
          <div className="relative">
            <input
              type="file"
              id="photo-upload"
              className="hidden"
              accept="image/*,video/*,.raw,.cr2,.nef,.arw,.dng"
              multiple
              onChange={onUploadPhoto}
              disabled={uploading || isStorageFull}
            />
            <Button asChild disabled={uploading || isStorageFull} size="sm" title={isStorageFull ? 'Хранилище заполнено. Перейдите на другой тариф' : ''} className="h-auto min-h-9 py-1.5">
              <label htmlFor="photo-upload" className={`${isStorageFull ? 'cursor-not-allowed' : 'cursor-pointer'} flex items-center justify-center gap-1.5`}>
                <Icon name={isStorageFull ? 'Ban' : 'Upload'} className="shrink-0" size={16} />
                <span className="text-xs sm:text-sm leading-tight text-center whitespace-normal max-w-[120px] sm:max-w-none">
                  {isStorageFull ? 'Хранилище заполнено' : uploading ? 'Загрузка...' : 'Загрузить фото / видео'}
                </span>
              </label>
            </Button>
          </div>
        )}
      </div>

      {selectedFolder && subfolders && subfolders.length > 0 && (
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin">
          {subfolders.map((sf) => {
            const isTechRejects = sf.folder_type === 'tech_rejects';
            const isRetouch = sf.folder_type === 'retouch';
            const isActive = selectedFolder.id === sf.id;
            const isUserCreated = isUserCreatedSubfolder(sf);

            const getButtonStyle = () => {
              if (isActive) {
                if (isTechRejects) return 'bg-red-600 text-white border-red-600';
                if (isRetouch) return 'bg-rose-600 text-white border-rose-600';
                return 'bg-blue-600 text-white border-blue-600';
              }
              if (isTechRejects) return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
              if (isRetouch) return 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100';
              return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
            };

            const getIconName = () => {
              if (isTechRejects) return 'AlertTriangle';
              if (isRetouch) return 'Sparkles';
              return 'FolderOpen';
            };

            return (
              <button
                key={sf.id}
                onClick={() => onSelectSubfolder?.(sf)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 border flex-shrink-0 ${getButtonStyle()}`}
              >
                <Icon
                  name={getIconName()}
                  size={14}
                  className="flex-shrink-0"
                />
                <span>{sf.folder_name}</span>
                <span className={`${isActive ? 'opacity-80' : 'opacity-60'}`}>
                  {sf.photo_count || 0}
                </span>
                {sf.has_password && (
                  <Icon name="Lock" size={12} className="flex-shrink-0" />
                )}
                {sf.is_hidden && (
                  <Icon name="EyeOff" size={12} className="flex-shrink-0" />
                )}
                {isUserCreated && onOpenSubfolderSettings && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSubfolderSettings(sf);
                    }}
                    className={`flex-shrink-0 rounded-full p-0.5 transition-colors ${
                      isActive ? 'hover:bg-white/20' : 'hover:bg-black/10'
                    }`}
                  >
                    <Icon name="Settings" size={12} />
                  </span>
                )}
                {onDeleteSubfolder && !isAdminViewing && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSubfolder(sf);
                    }}
                    className={`flex-shrink-0 rounded-full p-0.5 transition-colors ${
                      isActive ? 'hover:bg-red-400/30' : 'hover:bg-red-100'
                    }`}
                    title="Удалить подпапку"
                  >
                    <Icon name="Trash2" size={12} className={isActive ? 'text-white' : 'text-red-500'} />
                  </span>
                )}
              </button>
            );
          })}
          {onCreateSubfolder && !isAdminViewing && (
            <button
              onClick={onCreateSubfolder}
              className="flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200 flex-shrink-0"
              title="Добавить папку"
            >
              <Icon name="Plus" size={14} />
            </button>
          )}
        </div>
      )}

      {selectedFolder && (!subfolders || subfolders.length === 0) && onCreateSubfolder && !isAdminViewing && (
        <div className="mt-3">
          <button
            onClick={onCreateSubfolder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200"
            title="Добавить папку"
          >
            <Icon name="Plus" size={14} />
            <span>Добавить папку</span>
          </button>
        </div>
      )}

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