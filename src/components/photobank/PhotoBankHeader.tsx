import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
  folder_type?: 'originals' | 'tech_rejects';
  parent_folder_id?: number | null;
}

interface Photo {
  id: number;
  file_name: string;
  s3_url: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface PhotoBankHeaderProps {
  folders: PhotoFolder[];
  selectedFolder: PhotoFolder | null;
  photos: Photo[];
  selectionMode: boolean;
  selectedPhotos: Set<number>;
  onNavigateBack: () => void;
  onAddToPhotobook: () => void;
  onCancelSelection: () => void;
  onStartSelection: () => void;
  onShowCreateFolder: () => void;
  onShowClearConfirm: () => void;
  onShowCameraUpload?: () => void;
  onShowUrlUpload?: () => void;
  onShowFavorites?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  isAdminViewing?: boolean;
  onDeleteSelectedPhotos?: () => void;
  onRestoreSelectedPhotos?: () => void;
  onShowStats?: () => void;
  onShowAllChats?: () => void;
  totalUnreadMessages?: number;
}

const PhotoBankHeader = ({
  folders,
  selectedFolder,
  photos,
  selectionMode,
  selectedPhotos,
  onNavigateBack,
  onAddToPhotobook,
  onCancelSelection,
  onStartSelection,
  onShowCreateFolder,
  onShowClearConfirm,
  onShowCameraUpload,
  onShowUrlUpload,
  onShowFavorites,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  isAdminViewing = false,
  onDeleteSelectedPhotos,
  onRestoreSelectedPhotos,
  onShowStats,
  onShowAllChats,
  totalUnreadMessages = 0,
}: PhotoBankHeaderProps) => {
  const navigate = useNavigate();
  const isTechRejectsFolder = selectedFolder?.folder_type === 'tech_rejects';
  
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onNavigateBack}
            className="h-9 w-9"
          >
            <Icon name="ArrowLeft" size={20} />
          </Button>
          <h1 className="text-3xl font-bold">Мой фото банк</h1>
        </div>
        
        {(onGoBack || onGoForward) && (
          <div className="flex items-center gap-1 border rounded-full p-1 bg-background shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoBack}
              disabled={!canGoBack}
              className="h-8 px-2 sm:px-3 rounded-full hover:bg-accent disabled:opacity-30 transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
              title="Назад"
            >
              <Icon name="ChevronLeft" size={18} />
              <span className="text-sm hidden sm:inline">Назад</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoForward}
              disabled={!canGoForward}
              className="h-8 px-2 sm:px-3 rounded-full hover:bg-accent disabled:opacity-30 transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
              title="Вперёд"
            >
              <span className="text-sm hidden sm:inline">Вперёд</span>
              <Icon name="ChevronRight" size={18} />
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
          {selectionMode && (
            <>
              {isTechRejectsFolder ? (
                <>
                  <Button 
                    variant="outline"
                    onClick={onRestoreSelectedPhotos}
                    disabled={selectedPhotos.size === 0}
                    className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
                  >
                    <Icon name="RotateCcw" size={24} />
                    <span className="text-[10px] text-center leading-tight">Вернуть в оригиналы ({selectedPhotos.size})</span>
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={onDeleteSelectedPhotos}
                    disabled={selectedPhotos.size === 0}
                    className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
                  >
                    <Icon name="Trash2" size={24} />
                    <span className="text-[10px] text-center leading-tight">Удалить в корзину ({selectedPhotos.size})</span>
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline"
                  onClick={onAddToPhotobook}
                  disabled={selectedPhotos.size === 0}
                  className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
                >
                  <Icon name="Plus" size={24} />
                  <span className="text-[10px] text-center leading-tight">Добавить в макет ({selectedPhotos.size})</span>
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={onCancelSelection}
                className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
              >
                <Icon name="X" size={24} />
                <span className="text-[10px] text-center leading-tight">Отмена</span>
              </Button>
            </>
          )}
          {!selectionMode && selectedFolder && photos.length > 0 && (
            <Button 
              variant="outline"
              onClick={onStartSelection}
              className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
            >
              <Icon name="CheckSquare" size={24} />
              <span className="text-[10px] text-center leading-tight">Выбрать фото</span>
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={onShowCreateFolder}
            className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
          >
            <Icon name="FolderPlus" size={24} />
            <span className="text-[10px] text-center leading-tight">Новая папка</span>
          </Button>
          {onShowCameraUpload && (
            <Button 
              variant="outline"
              onClick={onShowCameraUpload}
              className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
            >
              <Icon name="Camera" size={24} />
              <span className="text-[10px] text-center leading-tight">Загрузить<br />с камеры</span>
            </Button>
          )}
          {onShowFavorites && selectedFolder && (
            <Button 
              variant="outline"
              onClick={onShowFavorites}
              className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
            >
              <Icon name="Star" size={24} />
              <span className="text-[10px] text-center leading-tight">Избранное</span>
            </Button>
          )}
          {onShowUrlUpload && (
            <Button 
              variant="outline"
              onClick={onShowUrlUpload}
              className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
            >
              <Icon name="Link" size={24} />
              <span className="text-[10px] text-center leading-tight">Загрузить<br />по ссылке</span>
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={() => navigate('/photo-bank/trash')}
            className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
          >
            <Icon name="Trash2" size={24} />
            <span className="text-[10px] text-center leading-tight">Корзина</span>
          </Button>
          {onShowStats && !selectedFolder && (
            <Button 
              variant="outline"
              onClick={onShowStats}
              className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
            >
              <Icon name="BarChart3" size={24} />
              <span className="text-[10px] text-center leading-tight">Статистика</span>
            </Button>
          )}
          {onShowAllChats && !selectedFolder && (
            <Button 
              variant="outline"
              onClick={onShowAllChats}
              className="aspect-square h-auto flex flex-col items-center justify-center gap-1.5 p-3 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border-purple-200 text-purple-900 hover:text-purple-950 relative transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95"
            >
              <Icon name="MessagesSquare" size={24} />
              <span className="text-[10px] text-center leading-tight">Сообщения</span>
              {totalUnreadMessages > 0 && (
                <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium text-white bg-red-600 rounded-full">
                  {totalUnreadMessages}
                </span>
              )}
            </Button>
          )}
        </div>
    </div>
  );
};

export default PhotoBankHeader;