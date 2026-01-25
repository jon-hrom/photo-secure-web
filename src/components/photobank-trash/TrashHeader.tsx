import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface TrashHeaderProps {
  hasFolders: boolean;
  hasPhotos: boolean;
  loading: boolean;
  onEmptyTrash: () => void;
}

const TrashHeader = ({ hasFolders, hasPhotos, loading, onEmptyTrash }: TrashHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/photo-bank')}
          className="h-9 w-9"
        >
          <Icon name="ArrowLeft" size={20} />
        </Button>
        <h1 className="text-3xl font-bold">Корзина</h1>
      </div>
      {(hasFolders || hasPhotos) && (
        <Button 
          variant="destructive"
          onClick={onEmptyTrash}
          disabled={loading}
          size="sm"
        >
          <Icon name="Trash2" className="mr-2" size={16} />
          Очистить корзину
        </Button>
      )}
    </div>
  );
};

export default TrashHeader;