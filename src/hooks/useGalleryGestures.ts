import { useState, useEffect, useCallback, useRef } from 'react';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
  s3_key?: string;
  is_video?: boolean;
  content_type?: string;
}

interface GestureState {
  zoom: number;
  panOffset: { x: number; y: number };
  isDragging: boolean;
  isZooming: boolean;
}

interface GestureHandlers {
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  resetZoom: () => void;
}

interface UseGalleryGesturesProps {
  currentPhoto: Photo | null;
  photos: Photo[];
  currentIndex: number;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export const useGalleryGestures = ({
  currentPhoto,
  photos,
  currentIndex,
  onNavigate
}: UseGalleryGesturesProps): GestureState & GestureHandlers => {
  const [zoom, setZoom] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number; touches: number } | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [pinchStart, setPinchStart] = useState<{ distance: number; zoom: number } | null>(null);
  
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < photos.length - 1;

  useEffect(() => {
    if (currentPhoto) {
      setZoom(0);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [currentPhoto?.id]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!currentPhoto) return;
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => {
        if (prev === 0) {
          setPanOffset({ x: 0, y: 0 });
          return delta > 0 ? 1.1 : 0;
        }
        const newZoom = prev + delta;
        if (newZoom < 0.5) {
          setPanOffset({ x: 0, y: 0 });
          return 0;
        }
        return Math.max(0, Math.min(2, newZoom));
      });
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [currentPhoto]);

  const getTouchDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touchCount = e.touches.length;
    if (touchCount === 1) {
      const currentZoom = zoomRef.current;
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
        touches: touchCount
      });
      if (currentZoom > 0) {
        setDragStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          offsetX: panOffset.x,
          offsetY: panOffset.y
        });
      }
    } else if (touchCount === 2) {
      const distance = getTouchDistance(e.touches);
      setPinchStart({ distance, zoom: zoomRef.current });
      setTouchStart({
        x: 0,
        y: 0,
        time: Date.now(),
        touches: touchCount
      });
    }
  }, [panOffset]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart || !currentPhoto) return;

    if (touchStart.touches > 1) {
      setTouchStart(null);
      setDragStart(null);
      setPinchStart(null);
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

    if (deltaTime > 150 && zoom > 0) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    const now = Date.now();
    if (deltaTime < 300 && absDeltaX < 10 && absDeltaY < 10) {
      if (now - lastTapTime < 300) {
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

    if (zoom > 0 && absDeltaY > 50 && absDeltaY > absDeltaX) {
      const zoomSteps = Math.floor(absDeltaY / 100);
      
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

    if (zoom > 0) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    if (absDeltaX > absDeltaY && absDeltaX > 50) {
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
      if (deltaY < 0) {
        setIsZooming(true);
        setZoom(prev => {
          if (prev === 0) return 2.0;
          const zoomSteps = Math.floor(absDeltaY / 100);
          const newZoom = Math.min(1.5, prev + (zoomSteps * 0.3));
          return newZoom;
        });
        setTimeout(() => setIsZooming(false), 500);
      }
    }

    setTouchStart(null);
    setDragStart(null);
  }, [touchStart, currentPhoto, zoom, lastTapTime, hasPrev, hasNext, onNavigate]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const currentZoom = zoomRef.current;
    if (currentZoom <= 0) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y
    });
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || zoomRef.current <= 0) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setPanOffset({
      x: dragStart.offsetX + deltaX,
      y: dragStart.offsetY + deltaY
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;

    if (e.touches.length === 2 && pinchStart) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      const scale = distance / pinchStart.distance;
      const baseZoom = pinchStart.zoom === 0 ? 1 : pinchStart.zoom;
      const newZoom = Math.max(0, Math.min(3, baseZoom * scale - (pinchStart.zoom === 0 ? 1 : 0)));
      setZoom(newZoom);
      return;
    }

    if (touchStart.touches > 1) return;
    
    const now = Date.now();
    const holdTime = now - touchStart.time;
    const currentZoom = zoomRef.current;
    
    if (currentZoom > 0 && holdTime > 150) {
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
  }, [touchStart, dragStart, panOffset, pinchStart]);

  const resetZoom = useCallback(() => {
    setZoom(0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return {
    zoom,
    panOffset,
    isDragging,
    isZooming,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetZoom
  };
};