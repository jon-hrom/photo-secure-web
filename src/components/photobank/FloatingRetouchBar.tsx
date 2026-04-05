import { useRef, useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useRetouch } from '@/contexts/RetouchContext';
import RetouchWakeStatus from './RetouchWakeStatus';
import RetouchTaskList, { RetouchLightbox } from './RetouchTaskList';
import type { RetouchTask } from './RetouchTaskList';

const FloatingRetouchBar = () => {
  const {
    tasks, isProcessing, waking, wakeStatus, minimized, session,
    totalProgress, totalBatchSize, fullClose, retryTask, retryAllFailed, setMinimized, photos
  } = useRetouch();

  const [showDialog, setShowDialog] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [mounted, setMounted] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxTasks, setLightboxTasks] = useState<RetouchTask[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const wasDraggedRef = useRef(false);

  const hasTasks = tasks.length > 0;
  const shouldShowBar = minimized && (isProcessing || hasTasks);

  useEffect(() => {
    if (shouldShowBar) {
      if (position.x === -1) {
        const mobile = window.innerWidth < 640;
        setPosition({
          x: mobile ? window.innerWidth - 100 : window.innerWidth - 280,
          y: window.innerHeight - (mobile ? 80 : 60)
        });
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setMounted(true));
      });
    } else {
      setMounted(false);
    }
  }, [shouldShowBar]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    isDraggingRef.current = true;
    wasDraggedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      wasDraggedRef.current = true;
    }
    const barWidth = window.innerWidth < 640 ? 90 : 260;
    const newX = Math.max(0, Math.min(window.innerWidth - barWidth, dragStartRef.current.startX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 44, dragStartRef.current.startY + dy));
    setPosition({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleBarClick = () => {
    if (wasDraggedRef.current) return;
    setShowDialog(true);
  };

  const handleDialogClose = (newOpen: boolean) => {
    if (!newOpen && !lightboxOpen) {
      setShowDialog(false);
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing) {
      setShowConfirm(true);
    } else {
      fullClose();
    }
  };

  const handleConfirmStop = () => {
    setShowConfirm(false);
    setShowDialog(false);
    fullClose();
  };

  const handleOpenLightbox = useCallback((finishedTasks: RetouchTask[], startIndex: number) => {
    setLightboxTasks(finishedTasks);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const finishedCount = tasks.filter(t => t.status === 'finished').length;
  const displayTotal = totalBatchSize > tasks.length ? totalBatchSize : tasks.length;

  return (
    <>
      {shouldShowBar && !showDialog && (() => {
        if (isMobile) {
          return (
            <div
              className={`fixed z-[9999] flex items-center gap-1.5 bg-gradient-to-r from-rose-600 to-purple-600 text-white rounded-full px-3 py-2 shadow-lg cursor-grab active:cursor-grabbing select-none touch-none transition-all duration-300 ease-out ${
                mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
              }`}
              style={{ left: position.x, top: position.y }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={handleBarClick}
            >
              <span className="text-[11px] font-semibold tabular-nums pointer-events-none whitespace-nowrap">
                {finishedCount}/{displayTotal}
              </span>
              <button
                onClick={handleCloseClick}
                className="flex-shrink-0 rounded-full p-0.5 active:bg-white/30 transition-colors"
              >
                <Icon name="X" size={12} />
              </button>
            </div>
          );
        }

        return (
          <div
            className={`fixed z-[9999] flex items-center gap-3 bg-gradient-to-r from-rose-600 to-purple-600 text-white rounded-full pl-4 pr-2 py-2 shadow-lg cursor-grab active:cursor-grabbing hover:shadow-xl select-none touch-none transition-all duration-300 ease-out ${
              mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
            }`}
            style={{ left: position.x, top: position.y }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleBarClick}
          >
            <Icon name="Sparkles" size={16} className="flex-shrink-0 pointer-events-none" />
            <span className="text-sm font-medium pointer-events-none">Ретушь</span>
            {isProcessing ? (
              <div className="flex items-center gap-2 pointer-events-none">
                <div className="w-16 h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-700"
                    style={{ width: `${totalProgress}%` }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                  {finishedCount}/{displayTotal}
                </span>
              </div>
            ) : (
              <span className="text-xs opacity-80 pointer-events-none">
                {finishedCount}/{displayTotal}
              </span>
            )}
            <button
              onClick={handleCloseClick}
              className="flex-shrink-0 rounded-full p-1 hover:bg-white/20 active:bg-white/30 transition-colors ml-1"
              title="Остановить и закрыть"
            >
              <Icon name="X" size={14} />
            </button>
          </div>
        );
      })()}

      {showDialog && session && (
        <Dialog open={true} onOpenChange={handleDialogClose}>
          <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-gradient-to-br from-rose-50/80 via-pink-50/60 to-purple-50/80 dark:from-rose-950/80 dark:via-pink-950/60 dark:to-purple-950/80 backdrop-blur-sm rounded-2xl sm:rounded-xl mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Icon name="Sparkles" size={18} className="text-rose-600" />
                Ретушь фото
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Папка: {session.folderName}
              </DialogDescription>
            </DialogHeader>

            <RetouchWakeStatus waking={waking} wakeStatus={wakeStatus} />

            <RetouchTaskList
              tasks={tasks}
              onRetryTask={retryTask}
              onRetryAllFailed={retryAllFailed}
              onOpenLightbox={handleOpenLightbox}
            />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm rounded-2xl sm:rounded-xl p-5 sm:p-6">
          <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Icon name="AlertTriangle" size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1.5">
              <DialogHeader className="p-0">
                <DialogTitle className="font-semibold text-base sm:text-lg text-foreground">Остановить обработку?</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1.5">
                  Оставшиеся фото не будут обработаны. Все фотографии, которые уже прошли ретушь, сохранены и доступны в вашей папке.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full mt-1">
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="h-11 sm:h-10 text-sm flex-1"
              >
                Продолжить
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmStop}
                className="h-11 sm:h-10 text-sm flex-1"
              >
                Остановить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {lightboxOpen && lightboxTasks.length > 0 && (
        <RetouchLightbox
          tasks={lightboxTasks}
          startIndex={lightboxIndex}
          onClose={handleCloseLightbox}
          originalPhotos={photos}
        />
      )}
    </>
  );
};

export default FloatingRetouchBar;