import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface UploadControlsProps {
  uploading: boolean;
  isOnline: boolean;
  totalFiles: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  selectedCount: number;
  skippedCount: number;
  onUpload: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
}

const UploadControls = ({
  uploading,
  isOnline,
  totalFiles,
  successCount,
  errorCount,
  pendingCount,
  selectedCount,
  skippedCount,
  onUpload,
  onCancel,
  onRetryFailed,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected
}: UploadControlsProps) => {
  return (
    <div className="space-y-4 border-t pt-4">
      {totalFiles > 0 && (
        <>
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-4">
              <span>Всего: {totalFiles}</span>
              {successCount > 0 && <span className="text-green-600">✓ {successCount}</span>}
              {errorCount > 0 && <span className="text-red-600">✗ {errorCount}</span>}
              {skippedCount > 0 && <span className="text-yellow-600">⊘ {skippedCount}</span>}
              {pendingCount > 0 && <span className="text-gray-600">⋯ {pendingCount}</span>}
            </div>
            {selectedCount > 0 && (
              <span className="text-primary font-medium">Выбрано: {selectedCount}</span>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={(successCount / totalFiles) * 100} />
              <p className="text-sm text-center text-muted-foreground">
                Загружено {successCount} из {totalFiles}
              </p>
            </div>
          )}

          {!uploading && totalFiles > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
                className="flex-1"
              >
                <Icon name="CheckSquare" className="mr-2" size={16} />
                Выбрать всё
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDeselectAll}
                className="flex-1"
              >
                <Icon name="Square" className="mr-2" size={16} />
                Снять выбор
              </Button>
              {selectedCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDeleteSelected}
                >
                  <Icon name="Trash2" size={16} />
                </Button>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex gap-3">
        {!uploading ? (
          <>
            <Button
              onClick={onUpload}
              disabled={totalFiles === 0 || !isOnline}
              className="flex-1"
              size="lg"
            >
              <Icon name="Upload" className="mr-2" size={20} />
              Загрузить ({totalFiles})
            </Button>
            {totalFiles > 0 && (
              <Button
                onClick={onCancel}
                variant="outline"
                size="lg"
              >
                <Icon name="X" size={20} />
              </Button>
            )}
          </>
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

      {errorCount > 0 && !uploading && (
        <Button
          onClick={onRetryFailed}
          variant="outline"
          className="w-full"
          disabled={!isOnline}
        >
          <Icon name="RefreshCw" className="mr-2" size={16} />
          Повторить неудачные ({errorCount})
        </Button>
      )}

      {!isOnline && (
        <div className="text-sm text-yellow-600 text-center p-2 bg-yellow-50 rounded">
          <Icon name="WifiOff" className="inline mr-2" size={16} />
          Нет подключения к интернету
        </div>
      )}
    </div>
  );
};

export default UploadControls;
