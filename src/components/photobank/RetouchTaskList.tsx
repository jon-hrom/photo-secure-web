import Icon from '@/components/ui/icon';

export interface RetouchTask {
  photo_id: number;
  task_id: string;
  status: 'queued' | 'started' | 'finished' | 'failed';
  result_url?: string;
  error_message?: string;
  file_name?: string;
}

interface RetouchTaskListProps {
  tasks: RetouchTask[];
  onRetryTask: (task: RetouchTask) => void;
  onRetryAllFailed: () => void;
}

const statusLabel = (status: string) => {
  switch (status) {
    case 'queued': return 'В очереди';
    case 'started': return 'Обработка...';
    case 'finished': return 'Готово';
    case 'failed': return 'Ошибка';
    default: return status;
  }
};

const statusColor = (status: string) => {
  switch (status) {
    case 'queued': return 'text-yellow-600';
    case 'started': return 'text-blue-600';
    case 'finished': return 'text-green-600';
    case 'failed': return 'text-red-600';
    default: return 'text-muted-foreground';
  }
};

const RetouchTaskList = ({ tasks, onRetryTask, onRetryAllFailed }: RetouchTaskListProps) => {
  if (tasks.length === 0) return null;

  const finishedCount = tasks.filter(t => t.status === 'finished').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const activeCount = tasks.filter(t => t.status === 'queued' || t.status === 'started').length;

  return (
    <div className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium">Прогресс:</span>
        {activeCount > 0 && (
          <span className="flex items-center gap-1 text-blue-600">
            <Icon name="Loader2" size={14} className="animate-spin" />
            {activeCount} в обработке
          </span>
        )}
        {finishedCount > 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <Icon name="CheckCircle" size={14} />
            {finishedCount} готово
          </span>
        )}
        {failedCount > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <Icon name="XCircle" size={14} />
            {failedCount} ошибок
          </span>
        )}
        {failedCount > 0 && activeCount === 0 && (
          <button
            onClick={onRetryAllFailed}
            className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-sm ml-auto font-medium"
          >
            <Icon name="RefreshCw" size={14} />
            Повторить ошибки
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {tasks.map((task) => (
          <div
            key={task.task_id || task.photo_id}
            className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded bg-white/50 dark:bg-gray-800/50"
          >
            <span className="truncate flex-1 text-muted-foreground">
              {task.file_name || `Фото #${task.photo_id}`}
            </span>
            <span className={`flex items-center gap-1 flex-shrink-0 ${statusColor(task.status)}`}>
              {(task.status === 'queued' || task.status === 'started') && (
                <Icon name="Loader2" size={12} className="animate-spin" />
              )}
              {task.status === 'finished' && <Icon name="CheckCircle" size={12} />}
              {task.status === 'failed' && <Icon name="XCircle" size={12} />}
              {statusLabel(task.status)}
            </span>
            {task.status === 'finished' && task.result_url && (
              <a
                href={task.result_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 flex-shrink-0"
              >
                <Icon name="Download" size={12} />
                Скачать
              </a>
            )}
            {task.status === 'failed' && (
              <button
                onClick={() => onRetryTask(task)}
                className="flex items-center gap-1 text-amber-600 hover:text-amber-700 flex-shrink-0 text-xs"
                title="Повторить ретушь"
              >
                <Icon name="RefreshCw" size={12} />
                Повторить
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RetouchTaskList;
