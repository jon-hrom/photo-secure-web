import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface UploadControlsProps {
  uploading: boolean;
  isOnline: boolean;
  totalFiles: number;
  errorCount: number;
  onUpload: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
}

const UploadControls = ({
  uploading,
  isOnline,
  totalFiles,
  errorCount,
  onUpload,
  onCancel,
  onRetryFailed
}: UploadControlsProps) => {
  return (
    <div className="space-y-4 border-t pt-4">
      {!isOnline && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          <Icon name="WifiOff" size={16} />
          <span>Нет подключения к интернету</span>
        </div>
      )}
      
      {errorCount > 0 && !uploading && (
        <Button
          onClick={onRetryFailed}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Icon name="RotateCw" className="mr-2" size={16} />
          Повторить неудачные ({errorCount})
        </Button>
      )}

      <div className="flex gap-3">
        {!uploading ? (
          <Button
            onClick={onUpload}
            disabled={totalFiles === 0 || !isOnline}
            className="flex-1"
            size="lg"
          >
            <Icon name="Upload" className="mr-2" size={20} />
            Загрузить ({totalFiles})
          </Button>
        ) : (
          <Button
            onClick={onCancel}
            variant="destructive"
            className="flex-1"
            size="lg"
          >
            <Icon name="X" className="mr-2" size={20} />
            Отменить
          </Button>
        )}
      </div>
    </div>
  );
};

export default UploadControls;
