import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { useRetouch } from '@/contexts/RetouchContext';
import RetouchTaskItem from './retouch-task-list/RetouchTaskItem';

export type { RetouchTask } from './retouch-task-list/types';
export { RetouchLightbox } from './retouch-task-list/RetouchLightbox';

import type { RetouchTask, RetouchTaskListProps } from './retouch-task-list/types';

const RetouchTaskList = ({ tasks, onRetryTask, onRetryAllFailed }: RetouchTaskListProps) => {
  const { totalProgress, totalBatchSize, isProcessing, openRetouchLightbox } = useRetouch();
  const listRef = useRef<HTMLDivElement>(null);
  const finishedTasksRef = useRef<RetouchTask[]>([]);

  const finishedTasks = tasks.filter(t => t.status === 'finished' && t.result_url);
  finishedTasksRef.current = finishedTasks;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const viewBtn = target.closest('[data-view-task]');
      if (viewBtn) {
        e.stopPropagation();
        e.preventDefault();
        const taskId = viewBtn.getAttribute('data-view-task');
        const ft = finishedTasksRef.current;
        const idx = ft.findIndex(t => String(t.task_id || t.photo_id) === taskId);
        if (idx >= 0) {
          openRetouchLightbox(ft, idx);
        }
      }
    };
    el.addEventListener('click', handler, true);
    return () => el.removeEventListener('click', handler, true);
  }, [openRetouchLightbox]);

  if (tasks.length === 0) return null;

  const finishedCount = tasks.filter(t => t.status === 'finished').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const activeCount = tasks.filter(t => t.status === 'queued' || t.status === 'started' || t.status === 'processing').length;
  const displayTotal = totalBatchSize > tasks.length ? totalBatchSize : tasks.length;
  const allDone = !isProcessing && activeCount === 0;
  const currentPhoto = tasks.find(t => t.status === 'started' || t.status === 'queued' || t.status === 'processing');

  return (
      <div ref={listRef} className="rounded-xl border bg-white/60 dark:bg-gray-900/60 p-3 sm:p-4 space-y-3 sm:space-y-4">
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
            <RetouchTaskItem
              key={`${task.photo_id}-${task.task_id || 'pending'}`}
              task={task}
              onRetryTask={onRetryTask}
            />
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