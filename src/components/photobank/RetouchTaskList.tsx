import Icon from '@/components/ui/icon';
import { useRetouch } from '@/contexts/RetouchContext';

export interface RetouchTask {
  photo_id: number;
  task_id: string;
  status: 'queued' | 'started' | 'finished' | 'failed';
  result_url?: string;
  error_message?: string;
  file_name?: string;
  progress?: number;
  created_at?: string;
}

interface RetouchTaskListProps {
  tasks: RetouchTask[];
  onRetryTask: (task: RetouchTask) => void;
  onRetryAllFailed: () => void;
}

const RetouchTaskList = ({ tasks, onRetryTask, onRetryAllFailed }: RetouchTaskListProps) => {
  const { totalProgress, totalBatchSize, isProcessing } = useRetouch();

  if (tasks.length === 0) return null;

  const finishedCount = tasks.filter(t => t.status === 'finished').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const activeCount = tasks.filter(t => t.status === 'queued' || t.status === 'started').length;
  const displayTotal = totalBatchSize > tasks.length ? totalBatchSize : tasks.length;
  const allDone = !isProcessing && activeCount === 0;

  const currentPhoto = tasks.find(t => t.status === 'started' || t.status === 'queued');

  return (
    <div className="rounded-xl border bg-white/60 dark:bg-gray-900/60 p-3 sm:p-4 space-y-3 sm:space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!allDone && (
              <Icon name="Loader2" size={16} className="animate-spin text-blue-500" />
            )}
            {allDone && failedCount === 0 && (
              <Icon name="CheckCircle" size={16} className="text-green-500" />
            )}
            {allDone && failedCount > 0 && finishedCount === 0 && (
              <Icon name="AlertCircle" size={16} className="text-red-500" />
            )}
            {allDone && failedCount > 0 && finishedCount > 0 && (
              <Icon name="AlertTriangle" size={16} className="text-amber-500" />
            )}
            <span className="font-medium text-foreground text-sm">
              {totalProgress}%
            </span>
            {displayTotal > 1 && (
              <span className="text-muted-foreground text-xs sm:text-sm">
                ({finishedCount} из {displayTotal})
              </span>
            )}
          </div>
          {failedCount > 0 && allDone && (
            <button
              onClick={onRetryAllFailed}
              className="flex items-center gap-1 text-amber-600 hover:text-amber-700 active:text-amber-800 text-xs font-medium transition-colors py-1 px-2 -mr-2 rounded-lg active:bg-amber-50 dark:active:bg-amber-950/30"
            >
              <Icon name="RefreshCw" size={13} />
              Повторить
            </button>
          )}
        </div>

        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              allDone && failedCount > 0 && finishedCount === 0
                ? 'bg-red-500'
                : allDone && failedCount > 0
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-blue-500 to-violet-500'
            }`}
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      <div className="space-y-1 sm:space-y-1.5 max-h-48 sm:max-h-60 overflow-y-auto -mx-1 px-1">
        {tasks.map((task) => (
          <div
            key={`${task.photo_id}-${task.task_id || 'pending'}`}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 rounded-lg bg-white/50 dark:bg-gray-800/50"
          >
            <div className="flex-shrink-0 w-4 sm:w-5">
              {task.status === 'queued' && (
                <Icon name="Clock" size={13} className="text-yellow-500 sm:w-3.5 sm:h-3.5" />
              )}
              {task.status === 'started' && (
                <Icon name="Loader2" size={13} className="animate-spin text-blue-500 sm:w-3.5 sm:h-3.5" />
              )}
              {task.status === 'finished' && (
                <Icon name="CheckCircle" size={13} className="text-green-500 sm:w-3.5 sm:h-3.5" />
              )}
              {task.status === 'failed' && (
                <Icon name="XCircle" size={13} className="text-red-500 sm:w-3.5 sm:h-3.5" />
              )}
            </div>

            <span className="truncate flex-1 text-muted-foreground">
              {task.file_name || `Фото #${task.photo_id}`}
            </span>

            {(task.status === 'started' || task.status === 'queued') && (
              <span className="text-[10px] sm:text-xs text-blue-500 font-medium flex-shrink-0 tabular-nums">
                {task.progress || 0}%
              </span>
            )}

            {task.status === 'finished' && task.result_url && (
              <a
                href={task.result_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 active:text-blue-800 flex-shrink-0 text-[10px] sm:text-xs transition-colors py-0.5 px-1 rounded active:bg-blue-50 dark:active:bg-blue-950/30"
              >
                <Icon name="Download" size={11} className="sm:w-3 sm:h-3" />
                <span className="hidden sm:inline">Скачать</span>
                <span className="sm:hidden">
                  <Icon name="Download" size={14} />
                </span>
              </a>
            )}
            {task.status === 'failed' && (
              <button
                onClick={() => onRetryTask(task)}
                className="flex items-center gap-1 text-amber-600 hover:text-amber-700 active:text-amber-800 flex-shrink-0 text-[10px] sm:text-xs transition-colors py-0.5 px-1 rounded active:bg-amber-50 dark:active:bg-amber-950/30"
              >
                <Icon name="RefreshCw" size={11} className="sm:w-3 sm:h-3" />
                Повтор
              </button>
            )}
          </div>
        ))}
      </div>

      {currentPhoto && displayTotal > 1 && (
        <div className="text-[10px] sm:text-xs text-muted-foreground text-center truncate px-2">
          Обрабатывается: {currentPhoto.file_name}
        </div>
      )}
    </div>
  );
};

export default RetouchTaskList;