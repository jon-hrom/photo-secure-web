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
  const [animatingIn, setAnimatingIn] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [visible, setVisible] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const wasDraggedRef = useRef(false);
  const prevShouldShowRef = useRef(false);

  const hasTasks = tasks.length > 0;
  const shouldShowBar = minimized && (isProcessing || hasTasks);

  useEffect(() => {
    if (shouldShowBar && !prevShouldShowRef.current) {
      const isMobile = window.innerWidth < 640;
      setPosition({
        x: isMobile ? 16 : window.innerWidth - 280,
        y: window.innerHeight - (isMobile ? 80 : 60)
      });
      setVisible(true);
      requestAnimationFrame(() => setAnimatingIn(true));
    }
    if (!shouldShowBar && prevShouldShowRef.current && visible) {
      setAnimatingOut(true);
      setAnimatingIn(false);
      const timer = setTimeout(() => {
        setVisible(false);
        setAnimatingOut(false);
      }, 300);
      return () => clearTimeout(timer);
    }
    prevShouldShowRef.current = shouldShowBar;
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
    const barWidth = window.innerWidth < 640 ? window.innerWidth - 32 : 260;
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
    if (!newOpen) {
      setShowDialog(false);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <>
      {visible && !showDialog && (
        <div
          className={`fixed z-[9999] flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-rose-600 to-purple-600 text-white rounded-full pl-3 sm:pl-4 pr-1.5 sm:pr-2 py-2 shadow-lg cursor-grab active:cursor-grabbing select-none touch-none transition-all duration-300 ease-out ${
            isMobile ? 'right-4 left-4' : ''
          } ${
            animatingIn && !animatingOut
              ? 'opacity-100 translate-y-0 scale-100'
              : animatingOut
                ? 'opacity-0 translate-y-4 scale-95'
                : 'opacity-0 translate-y-4 scale-95'
          }`}
          style={isMobile ? { top: position.y, left: undefined, right: undefined } : { left: position.x, top: position.y }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleBarClick}
        >
          <Icon name="Sparkles" size={isMobile ? 14 : 16} className="flex-shrink-0 pointer-events-none" />
          <span className="text-xs sm:text-sm font-medium pointer-events-none">Ретушь</span>
          {isProcessing ? (
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-none flex-1 sm:flex-none">
              <div className="w-16 sm:w-20 h-1.5 bg-white/30 rounded-full overflow-hidden">
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
            className="flex-shrink-0 rounded-full p-1.5 sm:p-1 hover:bg-white/20 active:bg-white/30 transition-colors ml-auto sm:ml-1"
            title="Остановить и закрыть"
          >
            <Icon name="X" size={isMobile ? 16 : 14} />
          </button>
        </div>
      )}

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
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default FloatingRetouchBar;
