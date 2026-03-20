import Icon from '@/components/ui/icon';

export interface RetouchTask {
  photo_id: number;
  task_id: string;
  status: 'queued' | 'started' | 'finished' | 'failed';
  result_url?: string;
  error_message?: string;
  file_name?: string;
  progress?: number;
}

interface RetouchTaskListProps {
  tasks: RetouchTask[];
  onRetryTask: (task: RetouchTask) => void;
  onRetryAllFailed: () => void;
}

const RetouchTaskList = ({ tasks, onRetryTask, onRetryAllFailed }: RetouchTaskListProps) => {
  if (tasks.length === 0) return null;

  const finishedCount = tasks.filter(t => t.status === 'finished').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const totalCount = tasks.length;
  const activeCount = tasks.filter(t => t.status === 'queued' || t.status === 'started').length;

  const totalProgress = totalCount > 0
    ? Math.round(tasks.reduce((sum, t) => {
        if (t.status === 'finished') return sum + 100;
        if (t.status === 'failed') return sum + 100;
        return sum + (t.progress || 0);
      }, 0) / totalCount)
    : 0;

  const currentPhoto = tasks.find(t => t.status === 'started' || t.status === 'queued');

  return (
    <div className="rounded-xl border bg-white/60 dark:bg-gray-900/60 p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <Icon name="Loader2" size={16} className="animate-spin text-blue-500" />
            )}
            {activeCount === 0 && failedCount === 0 && (
              <Icon name="CheckCircle" size={16} className="text-green-500" />
            )}
            {activeCount === 0 && failedCount > 0 && finishedCount === 0 && (
              <Icon name="AlertCircle" size={16} className="text-red-500" />
            )}
            {activeCount === 0 && failedCount > 0 && finishedCount > 0 && (
              <Icon name="AlertTriangle" size={16} className="text-amber-500" />
            )}
            <span className="font-medium text-foreground">
              {totalProgress}%
            </span>
            {totalCount > 1 && (
              <span className="text-muted-foreground">
                ({finishedCount} из {totalCount})
              </span>
            )}
          </div>
          {failedCount > 0 && activeCount === 0 && (
            <button
              onClick={onRetryAllFailed}
              className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-xs font-medium transition-colors"
            >
              <Icon name="RefreshCw" size={13} />
              Повторить
            </button>
          )}
        </div>

        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              failedCount > 0 && activeCount === 0 && finishedCount === 0
                ? 'bg-red-500'
                : failedCount > 0 && activeCount === 0
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-blue-500 to-violet-500'
            }`}
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {tasks.map((task) => (
          <div
            key={task.task_id || task.photo_id}
            className="flex items-center gap-2 text-sm py-2 px-3 rounded-lg bg-white/50 dark:bg-gray-800/50"
          >
            <div className="flex-shrink-0 w-5">
              {task.status === 'queued' && (
                <Icon name="Clock" size={14} className="text-yellow-500" />
              )}
              {task.status === 'started' && (
                <Icon name="Loader2" size={14} className="animate-spin text-blue-500" />
              )}
              {task.status === 'finished' && (
                <Icon name="CheckCircle" size={14} className="text-green-500" />
              )}
              {task.status === 'failed' && (
                <Icon name="XCircle" size={14} className="text-red-500" />
              )}
            </div>

            <span className="truncate flex-1 text-muted-foreground">
              {task.file_name || `Фото #${task.photo_id}`}
            </span>

            {(task.status === 'started' || task.status === 'queued') && (
              <span className="text-xs text-blue-500 font-medium flex-shrink-0 tabular-nums">
                {task.progress || 0}%
              </span>
            )}

            {task.status === 'finished' && task.result_url && (
              <a
                href={task.result_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 flex-shrink-0 text-xs transition-colors"
              >
                <Icon name="Download" size={12} />
                Скачать
              </a>
            )}
            {task.status === 'failed' && (
              <button
                onClick={() => onRetryTask(task)}
                className="flex items-center gap-1 text-amber-600 hover:text-amber-700 flex-shrink-0 text-xs transition-colors"
              >
                <Icon name="RefreshCw" size={12} />
                Повторить
              </button>
            )}
          </div>
        ))}
      </div>

      {currentPhoto && totalCount > 1 && (
        <div className="text-xs text-muted-foreground text-center">
          Обрабатывается: {currentPhoto.file_name}
        </div>
      )}
    </div>
  );
};

export default RetouchTaskList;
