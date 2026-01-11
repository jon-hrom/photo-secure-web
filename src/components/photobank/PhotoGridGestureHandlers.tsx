import { useState, useEffect, useCallback } from 'react';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface GestureState {
  zoom: number;
  panOffset: { x: number; y: number };
  isDragging: boolean;
  isZooming: boolean;
  isLandscape: boolean;
  showContextMenu: boolean;
  imageError: boolean;
  isLoadingFullRes: boolean;
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

interface UsePhotoGridGesturesProps {
  viewPhoto: Photo | null;
  photos: Photo[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export const usePhotoGridGestures = ({
  viewPhoto,
  photos,
  onClose,
  onNavigate
}: UsePhotoGridGesturesProps): GestureState & GestureHandlers => {
  const [zoom, setZoom] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number; touches: number } | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoadingFullRes, setIsLoadingFullRes] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuTimer, setContextMenuTimer] = useState<NodeJS.Timeout | null>(null);

  const currentPhotoIndex = viewPhoto ? photos.findIndex(p => p.id === viewPhoto.id) : -1;
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < photos.length - 1;

  useEffect(() => {
    if (viewPhoto) {
      setZoom(0);
      setPanOffset({ x: 0, y: 0 });
      setImageError(false);
      setIsLoadingFullRes(false);
    }
  }, [viewPhoto?.id]);

  // Автоматическая загрузка оригинала при достижении 300% (zoom >= 2.0)
  useEffect(() => {
    if (zoom >= 2.0 && viewPhoto && !viewPhoto.is_raw && viewPhoto.s3_url) {
      console.log('[PHOTO_VIEWER] Auto-loading original at 300% zoom:', viewPhoto.file_name);
      setIsLoadingFullRes(true);
    }
  }, [zoom, viewPhoto]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewPhoto) return;
      
      if (e.key === 'Escape') {
        onClose();
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onNavigate('prev');
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNavigate('next');
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!viewPhoto) return;
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => {
        if (prev === 0) {
          setPanOffset({ x: 0, y: 0 });
          setImageError(false);
          return delta > 0 ? 1.1 : 0;
        }
        const newZoom = prev + delta;
        if (newZoom < 0.5) {
          setPanOffset({ x: 0, y: 0 });
          setImageError(false);
          return 0;
        }
        return Math.max(0, Math.min(2, newZoom));
      });
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
      if (zoom > 0) {
        setDragStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          offsetX: panOffset.x,
          offsetY: panOffset.y
        });
      }
      
      // Таймер для контекстного меню - 800мс удержания
      const timer = setTimeout(() => {
        if (zoom === 0) { // Показываем меню только если не увеличено
          setShowContextMenu(true);
          // Вибрация для тактильной обратной связи
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
      // Отменяем таймер при мультитач
      if (contextMenuTimer) {
        clearTimeout(contextMenuTimer);
        setContextMenuTimer(null);
      }
    }
  }, [zoom, panOffset, contextMenuTimer]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Отменяем таймер контекстного меню
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

    console.log('[TOUCH] TouchEnd:', {
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

    // Если это был drag (долгое удержание) - просто завершаем, не меняем zoom
    if (deltaTime > 150 && zoom > 0) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    // Обработка двойного тапа
    const now = Date.now();
    if (deltaTime < 300 && absDeltaX < 10 && absDeltaY < 10) {
      if (now - lastTapTime < 300) {
        // Двойной тап - сброс zoom
        setZoom(0);
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

    // Если фото увеличено - обработка вертикальных свайпов
    if (zoom > 0 && absDeltaY > 50 && absDeltaY > absDeltaX) {
      const zoomSteps = Math.floor(absDeltaY / 100);
      
      // Свайп вниз с верхней половины экрана - уменьшение
      if (deltaY > 0 && isUpperHalf) {
        setIsZooming(true);
        setZoom(prev => {
          const newZoom = Math.max(0, prev - (zoomSteps * 0.3));
          if (newZoom < 0.3) {
            setPanOffset({ x: 0, y: 0 });
            return 0;
          }
          return newZoom;
        });
        setTimeout(() => setIsZooming(false), 500);
        setTouchStart(null);
        setDragStart(null);
        return;
      }
      
      // Свайп вверх - увеличение
      if (deltaY < 0) {
        setIsZooming(true);
        setZoom(prev => {
          const newZoom = Math.min(1.5, prev + (zoomSteps * 0.3));
          return newZoom;
        });
        setTimeout(() => setIsZooming(false), 500);
        setTouchStart(null);
        setDragStart(null);
        return;
      }
    }

    // Если фото увеличено и это не вертикальный свайп - это drag для перемещения
    if (zoom > 0) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    // Фото не увеличено (zoom === 0)
    if (absDeltaX > absDeltaY && absDeltaX > 50) {
      // Горизонтальный свайп - переключение фото
      if (deltaX > 0 && hasPrev) {
        onNavigate('prev');
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      } else if (deltaX < 0 && hasNext) {
        onNavigate('next');
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      }
    } else if (absDeltaY > absDeltaX && absDeltaY > 50) {
      // Вертикальный свайп вверх - приближение
      if (deltaY < 0) {
        setIsZooming(true);
        setZoom(prev => {
          // Первый свайп - сразу 300% (zoom = 2.0)
          if (prev === 0) return 2.0;
          // Дальше докручиваем до 250% (zoom = 1.5)
          const zoomSteps = Math.floor(absDeltaY / 100);
          const newZoom = Math.min(1.5, prev + (zoomSteps * 0.3));
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
    setZoom(0);
    setPanOffset({ x: 0, y: 0 });
    setTimeout(() => setIsZooming(false), 500);
  }, []);

  const handleCloseDialog = useCallback(() => {
    onClose();
    setZoom(0);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setDragStart(null);
    setImageError(false);
    setIsLoadingFullRes(false);
  }, [onClose]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 0) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y
    });
  }, [zoom, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || zoom <= 0) return;
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
    
    // Отменяем таймер контекстного меню при движении
    if (contextMenuTimer) {
      clearTimeout(contextMenuTimer);
      setContextMenuTimer(null);
    }
    
    // Если увеличено и держим больше 150ms - это drag для перемещения
    if (zoom > 0 && holdTime > 150) {
      e.preventDefault();
      
      // Инициализируем dragStart если его нет
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
    setZoom(0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return {
    zoom,
    panOffset,
    isDragging,
    isZooming,
    isLandscape,
    showContextMenu,
    imageError,
    isLoadingFullRes,
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
