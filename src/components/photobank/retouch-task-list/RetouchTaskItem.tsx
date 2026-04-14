import Icon from '@/components/ui/icon';
import type { RetouchTask } from './types';

interface RetouchTaskItemProps {
  task: RetouchTask;
  onRetryTask: (task: RetouchTask) => void;
}

const RetouchTaskItem = ({ task, onRetryTask }: RetouchTaskItemProps) => {
  return (
    <div
      className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 rounded-lg bg-white/50 dark:bg-gray-800/50 ${
        task.status === 'finished' && task.result_url ? 'cursor-pointer hover:bg-white/80 dark:hover:bg-gray-700/60 transition-colors' : ''
      }`}
      {...(task.status === 'finished' && task.result_url ? { 'data-view-task': String(task.task_id || task.photo_id) } : {})}
    >
      <div className="flex-shrink-0 w-4 sm:w-5">
        {task.status === 'queued' && (
          <Icon name="Clock" size={13} className="text-yellow-500 sm:w-3.5 sm:h-3.5" />
        )}
        {(task.status === 'started' || task.status === 'processing') && (
          <Icon name="Loader2" size={13} className="animate-spin text-blue-500 sm:w-3.5 sm:h-3.5" />
        )}
        {task.status === 'finished' && (
          <Icon name="CheckCircle" size={13} className="text-green-500 sm:w-3.5 sm:h-3.5" />
        )}
        {task.status === 'failed' && (
          <Icon name="XCircle" size={13} className="text-red-500 sm:w-3.5 sm:h-3.5" />
        )}
      </div>

      <div className="truncate flex-1 min-w-0">
        <span className="text-muted-foreground">
          {task.file_name || `Фото #${task.photo_id}`}
        </span>
        {task.status === 'failed' && task.error_message && (
          <div className="text-[10px] text-red-400 truncate">{task.error_message}</div>
        )}
      </div>

      {(task.status === 'started' || task.status === 'queued' || task.status === 'processing') && (
        <span className="text-[10px] sm:text-xs text-blue-500 font-medium flex-shrink-0 tabular-nums">
          {task.progress || 0}%
        </span>
      )}

      {task.status === 'finished' && task.result_url && (
        <button
          data-view-task={String(task.task_id || task.photo_id)}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 active:text-blue-800 flex-shrink-0 text-[10px] sm:text-xs transition-colors py-0.5 px-1 rounded active:bg-blue-50 dark:active:bg-blue-950/30"
        >
          <Icon name="Eye" size={11} className="sm:w-3 sm:h-3" />
          <span className="hidden sm:inline">Просмотр</span>
        </button>
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
  );
};

export default RetouchTaskItem;