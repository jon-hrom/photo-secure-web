import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import Icon from '@/components/ui/icon';

interface FolderDownloadDialogProps {
  open: boolean;
  folderName: string;
  progress: number;
  currentFile: string;
  downloadedFiles: number;
  totalFiles: number;
  status: 'preparing' | 'downloading' | 'completed' | 'error';
  errorMessage?: string;
}

const FolderDownloadDialog = ({
  open,
  folderName,
  progress,
  currentFile,
  downloadedFiles,
  totalFiles,
  status,
  errorMessage
}: FolderDownloadDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        hideCloseButton={status !== 'completed' && status !== 'error'}
        aria-describedby="download-progress-description"
      >
        <VisuallyHidden>
          <DialogTitle>Скачивание папки {folderName}</DialogTitle>
          <div id="download-progress-description">
            Отображение прогресса скачивания файлов из папки
          </div>
        </VisuallyHidden>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            {status === 'preparing' && (
              <Icon name="Loader2" size={24} className="text-blue-600 animate-spin flex-shrink-0" />
            )}
            {status === 'downloading' && (
              <Icon name="Download" size={24} className="text-blue-600 flex-shrink-0" />
            )}
            {status === 'completed' && (
              <Icon name="CheckCircle2" size={24} className="text-green-600 flex-shrink-0" />
            )}
            {status === 'error' && (
              <Icon name="AlertCircle" size={24} className="text-red-600 flex-shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{folderName}</h3>
              {status === 'preparing' && (
                <p className="text-sm text-muted-foreground">Подготовка списка файлов...</p>
              )}
              {status === 'downloading' && (
                <p className="text-sm text-muted-foreground">
                  Скачано: {downloadedFiles} из {totalFiles}
                </p>
              )}
              {status === 'completed' && (
                <p className="text-sm text-green-600">Файлы успешно скачаны!</p>
              )}
              {status === 'error' && (
                <p className="text-sm text-red-600">{errorMessage || 'Ошибка при скачивании'}</p>
              )}
            </div>
          </div>

          {(status === 'preparing' || status === 'downloading') && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress)}%</span>
                {status === 'downloading' && totalFiles > 0 && (
                  <span>{downloadedFiles} / {totalFiles}</span>
                )}
              </div>
              {currentFile && (
                <div className="mt-2 p-2 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground truncate">{currentFile}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FolderDownloadDialog;
