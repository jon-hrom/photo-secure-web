import { useRef, useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useRetouch } from '@/contexts/RetouchContext';
import RetouchWakeStatus from './RetouchWakeStatus';
import RetouchTaskList from './RetouchTaskList';

const FloatingRetouchBar = () => {
  const {
    tasks, isProcessing, waking, wakeStatus, minimized, session,
    totalProgress, fullClose, retryTask, retryAllFailed, setMinimized
  } = useRetouch();

  const [showDialog, setShowDialog] = useState(false);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const wasDraggedRef = useRef(false);

  useEffect(() => {
    if (position.x === -1 && position.y === -1) {
      setPosition({
        x: window.innerWidth - 280,
        y: window.innerHeight - 60
      });
    }
  }, []);

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
    const newX = Math.max(0, Math.min(window.innerWidth - 260, dragStartRef.current.startX + dx));
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
    if (!newOpen) {
      setShowDialog(false);
    }
  };

  const hasTasks = tasks.length > 0;
  const shouldShowBar = minimized && (isProcessing || hasTasks);

  if (!shouldShowBar && !showDialog) return null;

  return (
    <>
      {shouldShowBar && !showDialog && (
        <div
          className="fixed z-[9999] flex items-center gap-3 bg-gradient-to-r from-rose-600 to-purple-600 text-white rounded-full pl-4 pr-2 py-2 shadow-lg cursor-grab active:cursor-grabbing hover:shadow-xl transition-shadow select-none touch-none"
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
              <div className="w-20 h-1.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums">{totalProgress}%</span>
            </div>
          ) : (
            <span className="text-xs opacity-80 pointer-events-none">
              {tasks.filter(t => t.status === 'finished').length}/{tasks.length}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              fullClose();
            }}
            className="flex-shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors ml-1"
            title="Остановить и закрыть"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {showDialog && session && (
        <Dialog open={true} onOpenChange={handleDialogClose}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-rose-50/80 via-pink-50/60 to-purple-50/80 dark:from-rose-950/80 dark:via-pink-950/60 dark:to-purple-950/80 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon name="Sparkles" size={20} className="text-rose-600" />
                Ретушь фото
              </DialogTitle>
              <DialogDescription>
                Папка: {session.folderName}
              </DialogDescription>
            </DialogHeader>

            <RetouchWakeStatus waking={waking} wakeStatus={wakeStatus} />

            <RetouchTaskList
              tasks={tasks}
              onRetryTask={retryTask}
              onRetryAllFailed={retryAllFailed}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default FloatingRetouchBar;
