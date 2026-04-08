import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/icon';
import type { RetouchTask } from './types';

export const RetouchLightbox = ({
  tasks,
  startIndex,
  onClose,
  originalPhotos,
}: {
  tasks: RetouchTask[];
  startIndex: number;
  onClose: () => void;
  originalPhotos: { id: number; s3_url?: string; thumbnail_s3_url?: string; data_url?: string }[];
}) => {
  const [index, setIndex] = useState(startIndex);
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);

  const zoomRef = useRef(zoom);
  const panRef = useRef(panOffset);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchStartRef = useRef<number | null>(null);
  const pinchZoomStartRef = useRef(0);
  const lastTapRef = useRef(0);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = panOffset; }, [panOffset]);

  const task = tasks[index];
  const originalPhoto = originalPhotos.find(p => p.id === task?.photo_id);
  const originalUrl = originalPhoto?.thumbnail_s3_url || originalPhoto?.s3_url || originalPhoto?.data_url || '';

  const resetView = useCallback(() => {
    setZoom(0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const navigate = useCallback((dir: 'prev' | 'next') => {
    resetView();
    setShowBefore(false);
    setIndex(i => {
      if (dir === 'prev') return i > 0 ? i - 1 : tasks.length - 1;
      return i < tasks.length - 1 ? i + 1 : 0;
    });
  }, [tasks.length, resetView]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
      if (e.key === 'ArrowLeft') navigate('prev');
      if (e.key === 'ArrowRight') navigate('next');
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose, navigate]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => {
        if (prev === 0 && delta > 0) {
          setPanOffset({ x: 0, y: 0 });
          return 1.1;
        }
        if (prev === 0 && delta < 0) return 0;
        const newZoom = prev + delta;
        if (newZoom < 0.5) {
          setPanOffset({ x: 0, y: 0 });
          return 0;
        }
        return Math.min(4, newZoom);
      });
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const getTouchDist = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
      if (zoomRef.current > 0) {
        dragStartRef.current = {
          x: e.touches[0].clientX, y: e.touches[0].clientY,
          ox: panRef.current.x, oy: panRef.current.y
        };
      }
    } else if (e.touches.length === 2) {
      pinchStartRef.current = getTouchDist(e.touches);
      pinchZoomStartRef.current = zoomRef.current;
      touchStartRef.current = null;
      dragStartRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      const scale = dist / pinchStartRef.current;
      const base = pinchZoomStartRef.current || 1;
      const newZoom = Math.max(0, Math.min(4, base * scale));
      if (newZoom < 0.3) {
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      } else {
        setZoom(newZoom);
      }
      return;
    }
    if (e.touches.length === 1 && dragStartRef.current && zoomRef.current > 0) {
      e.preventDefault();
      setIsDragging(true);
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPanOffset({ x: dragStartRef.current.ox + dx, y: dragStartRef.current.oy + dy });
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    pinchStartRef.current = null;
    setIsDragging(false);

    const start = touchStartRef.current;
    if (!start) { dragStartRef.current = null; return; }

    const end = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY, time: Date.now() };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dt = end.time - start.time;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 10 && absDy < 10 && dt < 300) {
      const now = Date.now();
      if (now - lastTapRef.current < 350) {
        lastTapRef.current = 0;
        if (zoomRef.current === 0) {
          setZoom(2.0);
          setPanOffset({ x: 0, y: 0 });
        } else {
          resetView();
        }
      } else {
        lastTapRef.current = now;
      }
      touchStartRef.current = null;
      dragStartRef.current = null;
      return;
    }

    if (zoomRef.current === 0 && dt < 400 && absDx > 50 && absDx > absDy * 1.5) {
      if (dx < 0) navigate('next');
      else navigate('prev');
    }

    if (zoomRef.current === 0 && dt < 400 && absDy > 80 && absDy > absDx * 1.5 && dy > 0) {
      onClose();
    }

    touchStartRef.current = null;
    dragStartRef.current = null;
  }, [navigate, onClose, resetView]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setWasDragged(false);
    if (zoomRef.current > 0) {
      dragStartRef.current = { x: e.clientX, y: e.clientY, ox: panRef.current.x, oy: panRef.current.y };
      setIsDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragStartRef.current && zoomRef.current > 0) {
      setWasDragged(true);
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPanOffset({ x: dragStartRef.current.ox + dx, y: dragStartRef.current.oy + dy });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (wasDragged) { setWasDragged(false); return; }
    if ((e.target as HTMLElement).closest('button')) return;
    if (zoomRef.current > 0) {
      resetView();
    }
  }, [wasDragged, resetView]);

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

  const scale = 1 + zoom;
  const showNav = tasks.length > 1 && zoom === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black"
      style={{ touchAction: 'none' }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="relative w-full h-full flex items-center justify-center" style={{ touchAction: 'none' }}>

          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 sm:px-4 z-50"
            style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="text-white/80 text-xs sm:text-sm bg-black/30 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shrink-0">
                {index + 1} / {tasks.length}
              </div>
              <div className="text-white/80 text-xs sm:text-sm bg-black/30 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full truncate max-w-[120px] sm:max-w-xs">
                {task.file_name || `Фото #${task.photo_id}`}
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {zoom > 0 && (
                <div className="text-white/80 text-xs sm:text-sm bg-black/30 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
                  {Math.round(scale * 100)}%
                </div>
              )}
              {originalUrl && (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setShowBefore(v => !v); }}
                  className={`h-8 sm:h-9 flex items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors backdrop-blur-sm ${
                    showBefore
                      ? 'bg-white/25 text-white'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <Icon name="ArrowLeftRight" size={14} />
                  <span>{showBefore ? 'До' : 'После'}</span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                disabled={downloading}
                className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 h-10 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 px-2 sm:px-2.5 hover:scale-110 active:scale-95"
                title="Скачать"
              >
                {downloading ? (
                  <Icon name="Loader2" size={16} className="text-white animate-spin" />
                ) : (
                  <Icon name="Download" size={16} className="text-white" />
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-10 h-10 sm:w-8 sm:h-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <Icon name="X" size={20} className="text-white" />
              </button>
            </div>
          </div>

          <div
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            style={{
              cursor: zoom === 0 ? 'default' : (isDragging ? 'grabbing' : 'grab'),
              touchAction: 'none',
              padding: '48px 0 0',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleContainerClick}
          >
            <img
              src={showBefore ? originalUrl : task.result_url}
              alt={task.file_name || ''}
              className="select-none touch-manipulation"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: zoom > 0 ? `scale(${scale}) translate(${panOffset.x / scale}px, ${panOffset.y / scale}px)` : undefined,
                transition: zoom > 0 && !isDragging ? 'transform 0.2s ease-out' : 'none',
                touchAction: 'none',
                pointerEvents: 'none',
              }}
              draggable={false}
            />
          </div>

          {showBefore && originalUrl && zoom === 0 && (
            <div
              className="absolute left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-sm"
              style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <span className="text-white/90 text-xs font-medium">Оригинал</span>
            </div>
          )}

          {showNav && (
            <>
              <button
                className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                onClick={() => navigate('prev')}
              >
                <Icon name="ChevronLeft" size={24} className="text-white" />
              </button>
              <button
                className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                onClick={() => navigate('next')}
              >
                <Icon name="ChevronRight" size={24} className="text-white" />
              </button>
            </>
          )}
        </div>
    </div>,
    document.body
  );
};

export default RetouchLightbox;
