import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
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
  onShowClearConfirm
}: PhotoBankHeaderProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onNavigateBack}
        >
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h1 className="text-3xl font-bold">Мой фото банк</h1>
      </div>
      <div className="flex gap-2">
        {selectionMode && (
          <>
            <Button 
              variant="default"
              onClick={onAddToPhotobook}
              disabled={selectedPhotos.size === 0}
            >
              <Icon name="Plus" className="mr-2" size={18} />
              Добавить в макет ({selectedPhotos.size})
            </Button>
            <Button 
              variant="outline"
              onClick={onCancelSelection}
            >
              Отмена
            </Button>
          </>
        )}
        {!selectionMode && selectedFolder && photos.length > 0 && (
          <Button 
            variant="outline"
            onClick={onStartSelection}
          >
            <Icon name="CheckSquare" className="mr-2" size={18} />
            Выбрать фото
          </Button>
        )}
        <Button 
          variant="outline"
          onClick={onShowCreateFolder}
        >
          <Icon name="FolderPlus" className="mr-2" size={18} />
          Новая папка
        </Button>
        <Button 
          variant="outline"
          onClick={() => navigate('/photo-bank/trash')}
        >
          <Icon name="Trash2" className="mr-2" size={18} />
          Корзина
        </Button>
      </div>
    </div>
  );
};

export default PhotoBankHeader;