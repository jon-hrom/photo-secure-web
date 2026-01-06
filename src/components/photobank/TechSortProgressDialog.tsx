import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface TechSortProgressDialogProps {
  open: boolean;
  progress: number;
  currentFile: string;
  processedCount: number;
  totalCount: number;
  rejectedCount: number;
  status: 'analyzing' | 'completed' | 'error';
  errorMessage?: string;
}

const TechSortProgressDialog = ({
  open,
  progress,
  currentFile,
  processedCount,
  totalCount,
  rejectedCount,
  status,
  errorMessage
}: TechSortProgressDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md max-w-[90vw] mx-4" hideCloseButton aria-describedby="tech-sort-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'analyzing' && (
              <>
                <Icon name="Loader2" size={20} className="animate-spin text-purple-600" />
                <span>Анализ фотографий</span>
              </>
            )}
            {status === 'completed' && (
              <>
                <Icon name="CheckCircle2" size={20} className="text-green-600" />
                <span>Анализ завершён</span>
              </>
            )}
            {status === 'error' && (
              <>
                <Icon name="XCircle" size={20} className="text-red-600" />
                <span>Ошибка анализа</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div id="tech-sort-description" className="space-y-4 py-4">
          {status === 'analyzing' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Обработано:</span>
                  <span className="font-medium">{processedCount} из {totalCount}</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{progress.toFixed(1)}%</p>
              </div>

              {rejectedCount > 0 && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <div className="flex items-center gap-2">
                    <Icon name="AlertTriangle" size={16} className="text-orange-600" />
                    <p className="text-sm font-medium text-orange-900">
                      Найдено браков: {rejectedCount}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1">Текущий файл:</p>
                <p className="text-sm font-medium truncate">{currentFile}</p>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Проверка на размытие</p>
                <p>• Анализ экспозиции (пересвет/недосвет)</p>
                <p>• Детекция закрытых глаз</p>
              </div>
            </>
          )}

          {status === 'completed' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Icon name="CheckCircle2" size={32} className="text-green-600" />
              </div>
              <p className="text-sm font-medium text-foreground mb-2">
                Обработано {processedCount} фотографий
              </p>
              {rejectedCount > 0 ? (
                <p className="text-sm text-orange-600 font-medium">
                  Найдено {rejectedCount} технических браков
                </p>
              ) : (
                <p className="text-sm text-green-600 font-medium">
                  Технических браков не найдено ✓
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {rejectedCount > 0 
                  ? 'Фото с браком перемещены в отдельную папку' 
                  : 'Все фотографии прошли проверку качества'}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Icon name="XCircle" size={32} className="text-red-600" />
              </div>
              <p className="text-sm text-red-600 font-medium">
                {errorMessage || 'Произошла ошибка при анализе'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TechSortProgressDialog;