import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

const RetouchLightbox = ({
  tasks,
  startIndex,
  onClose,
}: {
  tasks: RetouchTask[];
  startIndex: number;
  onClose: () => void;
}) => {
  const [index, setIndex] = useState(startIndex);
  const [downloading, setDownloading] = useState(false);

  const task = tasks[index];

  const goPrev = useCallback(() => {
    setIndex(i => (i > 0 ? i - 1 : tasks.length - 1));
  }, [tasks.length]);

  const goNext = useCallback(() => {
    setIndex(i => (i < tasks.length - 1 ? i + 1 : 0));
  }, [tasks.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleDownload = async () => {
    if (!task?.result_url || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(task.result_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = task.file_name || `retouch_${task.photo_id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[RETOUCH] Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (!task) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black"
      style={{ zIndex: 99999, width: '100vw', height: '100dvh', top: 0, left: 0 }}
      onClick={onClose}
    >
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-5 z-10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white/60 text-xs sm:text-sm flex-shrink-0">
            {index + 1} / {tasks.length}
          </span>
          <span className="text-white text-xs sm:text-sm truncate max-w-[50vw]">
            {task.file_name || `Фото #${task.photo_id}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/25 transition-colors"
            title="Скачать"
          >
            {downloading ? (
              <Icon name="Loader2" size={20} className="animate-spin" />
            ) : (
              <Icon name="Download" size={20} />
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/25 transition-colors"
          >
            <Icon name="X" size={22} />
          </button>
        </div>
      </div>

      <img
        src={task.result_url}
        alt={task.file_name || ''}
        className="w-full h-full object-contain select-none pointer-events-none"
        style={{ padding: '56px 0 max(16px, env(safe-area-inset-bottom))' }}
        draggable={false}
      />

      {tasks.length > 1 && (
        <>
          <button
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 active:bg-black/80 text-white transition-colors backdrop-blur-sm"
            onClick={e => { e.stopPropagation(); goPrev(); }}
          >
            <Icon name="ChevronLeft" size={28} />
          </button>
          <button
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 active:bg-black/80 text-white transition-colors backdrop-blur-sm"
            onClick={e => { e.stopPropagation(); goNext(); }}
          >
            <Icon name="ChevronRight" size={28} />
          </button>
        </>
      )}
    </div>,
    document.body
  );
};

const RetouchTaskList = ({ tasks, onRetryTask, onRetryAllFailed }: RetouchTaskListProps) => {
  const { totalProgress, totalBatchSize, isProcessing } = useRetouch();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (tasks.length === 0) return null;

  const finishedCount = tasks.filter(t => t.status === 'finished').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const activeCount = tasks.filter(t => t.status === 'queued' || t.status === 'started').length;
  const displayTotal = totalBatchSize > tasks.length ? totalBatchSize : tasks.length;
  const allDone = !isProcessing && activeCount === 0;
  const currentPhoto = tasks.find(t => t.status === 'started' || t.status === 'queued');

  const finishedTasks = tasks.filter(t => t.status === 'finished' && t.result_url);

  const openLightbox = (task: RetouchTask) => {
    const idx = finishedTasks.findIndex(t => t.task_id === task.task_id);
    if (idx >= 0) setLightboxIndex(idx);
  };

  return (
    <>
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
              className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 rounded-lg bg-white/50 dark:bg-gray-800/50 ${
                task.status === 'finished' && task.result_url ? 'cursor-pointer hover:bg-white/80 dark:hover:bg-gray-700/60 transition-colors' : ''
              }`}
              onClick={() => {
                if (task.status === 'finished' && task.result_url) openLightbox(task);
              }}
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
                <button
                  onClick={e => { e.stopPropagation(); openLightbox(task); }}
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
          ))}
        </div>

        {currentPhoto && displayTotal > 1 && (
          <div className="text-[10px] sm:text-xs text-muted-foreground text-center truncate px-2">
            Обрабатывается: {currentPhoto.file_name}
          </div>
        )}
      </div>

      {lightboxIndex !== null && finishedTasks.length > 0 && (
        <RetouchLightbox
          tasks={finishedTasks}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
};

export default RetouchTaskList;