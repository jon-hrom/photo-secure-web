import { useState, useEffect, useCallback } from 'react';
import { TrashedPhoto } from './types';

interface GestureState {
  zoom: number;
  panOffset: { x: number; y: number };
  isDragging: boolean;
  isZooming: boolean;
  showContextMenu: boolean;
}

interface GestureHandlers {
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleDoubleTap: (e: React.TouchEvent | React.MouseEvent) => void;
  handleCloseDialog: () => void;
  setShowContextMenu: (show: boolean) => void;
  resetZoom: () => void;
}

interface UseTrashedPhotoGesturesProps {
  viewPhoto: TrashedPhoto | null;
  photos: TrashedPhoto[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export const useTrashedPhotoGestures = ({
  viewPhoto,
  photos,
  onClose,
  onNavigate
}: UseTrashedPhotoGesturesProps): GestureState & GestureHandlers => {
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number; touches: number } | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuTimer, setContextMenuTimer] = useState<NodeJS.Timeout | null>(null);

  const currentPhotoIndex = viewPhoto ? photos.findIndex(p => p.id === viewPhoto.id) : -1;
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < photos.length - 1;

  useEffect(() => {
    if (viewPhoto) {
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [viewPhoto?.id]);

  useEffect(() => {
    if (zoom >= 3.0 && viewPhoto && viewPhoto.s3_url) {
      console.log('[TRASH_VIEWER] Auto-loading original at 300% zoom:', viewPhoto.file_name);
    }
  }, [zoom, viewPhoto]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewPhoto) return;
      
      if (e.key === 'Escape') {
        onClose();
        setZoom(1);
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onNavigate('prev');
        setZoom(1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNavigate('next');
        setZoom(1);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!viewPhoto) return;
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(1, Math.min(2, prev + delta)));
    };

    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [viewPhoto, hasPrev, hasNext, onClose, onNavigate]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touchCount = e.touches.length;
    if (touchCount === 1) {
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
        touches: touchCount
      });
      if (zoom > 1) {
        setDragStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          offsetX: panOffset.x,
          offsetY: panOffset.y
        });
      }
      
      const timer = setTimeout(() => {
        if (zoom === 1) {
          setShowContextMenu(true);
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      }, 800);
      setContextMenuTimer(timer);
    } else if (touchCount > 1) {
      setTouchStart({
        x: 0,
        y: 0,
        time: Date.now(),
        touches: touchCount
      });
      if (contextMenuTimer) {
        clearTimeout(contextMenuTimer);
        setContextMenuTimer(null);
      }
    }
  }, [zoom, panOffset, contextMenuTimer]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (contextMenuTimer) {
      clearTimeout(contextMenuTimer);
      setContextMenuTimer(null);
    }

    if (!touchStart || !viewPhoto) return;

    if (touchStart.touches > 1) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const deltaTime = touchEnd.time - touchStart.time;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const isUpperHalf = touchStart.y < window.innerHeight / 2;

    console.log('[TRASH_TOUCH] TouchEnd:', {
      deltaX,
      deltaY,
      absDeltaX,
      absDeltaY,
      deltaTime,
      zoom,
      isUpperHalf,
      isDrag: deltaTime > 150,
      touchStartY: touchStart.y,
      screenHeight: window.innerHeight
    });

    if (deltaTime > 150 && zoom > 1) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    const now = Date.now();
    if (deltaTime < 300 && absDeltaX < 10 && absDeltaY < 10) {
      if (now - lastTapTime < 300) {
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
        setLastTapTime(0);
        setTouchStart(null);
        setDragStart(null);
        return;
      }
      setLastTapTime(now);
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    if (zoom > 1 && absDeltaY > 50 && absDeltaY > absDeltaX) {
      const zoomSteps = Math.floor(absDeltaY / 100);
      
      if (deltaY > 0 && isUpperHalf) {
        setIsZooming(true);
        setZoom(prev => {
          const newZoom = Math.max(1, prev - (zoomSteps * 0.3));
          if (newZoom <= 1.3) {
            setPanOffset({ x: 0, y: 0 });
            return 1;
          }
          return newZoom;
        });
        setTimeout(() => setIsZooming(false), 500);
        setTouchStart(null);
        setDragStart(null);
        return;
      }
      
      if (deltaY < 0) {
        setIsZooming(true);
        setZoom(prev => {
          const newZoom = Math.min(2.5, prev + (zoomSteps * 0.3));
          return newZoom;
        });
        setTimeout(() => setIsZooming(false), 500);
        setTouchStart(null);
        setDragStart(null);
        return;
      }
    }

    if (zoom > 1) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    if (absDeltaX > absDeltaY && absDeltaX > 50) {
      if (deltaX > 0 && hasPrev) {
        onNavigate('prev');
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (deltaX < 0 && hasNext) {
        onNavigate('next');
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
      }
    } else if (absDeltaY > absDeltaX && absDeltaY > 50) {
      if (deltaY < 0) {
        setIsZooming(true);
        setZoom(prev => {
          if (prev === 1) return 3.0;
          const zoomSteps = Math.floor(absDeltaY / 100);
          const newZoom = Math.min(2.5, prev + (zoomSteps * 0.3));
          return newZoom;
        });
        setTimeout(() => setIsZooming(false), 500);
      }
    }

    setTouchStart(null);
    setDragStart(null);
  }, [touchStart, viewPhoto, zoom, lastTapTime, hasPrev, hasNext, onNavigate, contextMenuTimer]);

  const handleDoubleTap = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsZooming(true);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setTimeout(() => setIsZooming(false), 500);
  }, []);

  const handleCloseDialog = useCallback(() => {
    onClose();
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setDragStart(null);
  }, [onClose]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y
    });
  }, [zoom, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || zoom <= 1) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setPanOffset({
      x: dragStart.offsetX + deltaX,
      y: dragStart.offsetY + deltaY
    });
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart || touchStart.touches > 1) return;
    
    const now = Date.now();
    const holdTime = now - touchStart.time;
    
    if (contextMenuTimer) {
      clearTimeout(contextMenuTimer);
      setContextMenuTimer(null);
    }
    
    if (zoom > 1 && holdTime > 150) {
      e.preventDefault();
      
      if (!dragStart) {
        setDragStart({
          x: touchStart.x,
          y: touchStart.y,
          offsetX: panOffset.x,
          offsetY: panOffset.y
        });
        return;
      }
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;
      setPanOffset({
        x: dragStart.offsetX + deltaX,
        y: dragStart.offsetY + deltaY
      });
    }
  }, [touchStart, zoom, dragStart, panOffset, contextMenuTimer]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return {
    zoom,
    panOffset,
    isDragging,
    isZooming,
    showContextMenu,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleTap,
    handleCloseDialog,
    setShowContextMenu,
    resetZoom
  };
};

// Экспортируем также функцию для закрытия контекстного меню
export const useContextMenuControl = () => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  return { showContextMenu, setShowContextMenu };
};