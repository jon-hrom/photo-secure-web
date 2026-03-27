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
  imageRef: React.RefObject<HTMLDivElement | null>;
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
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
}

export const useGalleryGestures = ({
  currentPhoto,
  photos,
  currentIndex,
  onNavigate,
  onSingleTap,
  onDoubleTap,
}: UseGalleryGesturesProps): GestureState & GestureHandlers => {
  const [zoom, setZoom] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isZooming, setIsZooming] = useState(false);

  const zoomRef = useRef(0);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const imageRef = useRef<HTMLDivElement | null>(null);

  const touchStartRef = useRef<{ x: number; y: number; time: number; touches: number } | null>(null);
  const lastTapTimeRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pinchEndedAtZeroRef = useRef(false);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < photos.length - 1;

  const applyTransform = useCallback((z: number, px: number, py: number, animated = false) => {
    if (!imageRef.current) return;
    const el = imageRef.current;
    if (animated) {
      el.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    } else {
      el.style.transition = 'none';
    }
    if (z > 0) {
      el.style.transform = `scale(${1 + z}) translate(${px / (1 + z)}px, ${py / (1 + z)}px)`;
    } else {
      el.style.transform = 'none';
    }
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (currentPhoto) {
      zoomRef.current = 0;
      panOffsetRef.current = { x: 0, y: 0 };
      setZoom(0);
      setPanOffset({ x: 0, y: 0 });
      if (imageRef.current) {
        imageRef.current.style.transition = 'none';
        imageRef.current.style.transform = 'none';
      }
    }
  }, [currentPhoto?.id]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!currentPhoto) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      const currentZ = zoomRef.current;
      let newZoom: number;

      if (currentZ === 0) {
        newZoom = delta > 0 ? 1.0 : 0;
        if (newZoom === 0) {
          panOffsetRef.current = { x: 0, y: 0 };
          setPanOffset({ x: 0, y: 0 });
        }
      } else {
        newZoom = currentZ + delta;
        if (newZoom < 0.3) {
          newZoom = 0;
          panOffsetRef.current = { x: 0, y: 0 };
          setPanOffset({ x: 0, y: 0 });
        } else {
          newZoom = Math.min(3, newZoom);
        }
      }

      zoomRef.current = newZoom;
      setZoom(newZoom);
      applyTransform(newZoom, panOffsetRef.current.x, panOffsetRef.current.y, true);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentPhoto, applyTransform]);

  const getTouchDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touchCount = e.touches.length;

    if (touchCount === 1) {
      const currentZoom = zoomRef.current;
      pinchEndedAtZeroRef.current = false;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
        touches: touchCount
      };
      if (currentZoom > 0) {
        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          offsetX: panOffsetRef.current.x,
          offsetY: panOffsetRef.current.y
        };
      }
    } else if (touchCount === 2) {
      isDraggingRef.current = false;
      setIsDragging(false);
      dragStartRef.current = null;
      const distance = getTouchDistance(e.touches);
      pinchStartRef.current = { distance, zoom: zoomRef.current };
      touchStartRef.current = {
        x: 0,
        y: 0,
        time: Date.now(),
        touches: touchCount
      };
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchStart = touchStartRef.current;
    if (!touchStart || !currentPhoto) return;

    isDraggingRef.current = false;
    setIsDragging(false);

    if (touchStart.touches > 1) {
      touchStartRef.current = null;
      dragStartRef.current = null;
      pinchStartRef.current = null;

      const currentZ = zoomRef.current;
      if (currentZ > 0 && currentZ < 0.15) {
        zoomRef.current = 0;
        panOffsetRef.current = { x: 0, y: 0 };
        setPanOffset({ x: 0, y: 0 });
        setZoom(0);
        applyTransform(0, 0, 0, true);
        pinchEndedAtZeroRef.current = true;
      } else if (currentZ > 0) {
        setZoom(currentZ);
        setPanOffset({ ...panOffsetRef.current });
        setIsZooming(false);
        pinchEndedAtZeroRef.current = false;
      } else {
        panOffsetRef.current = { x: 0, y: 0 };
        setPanOffset({ x: 0, y: 0 });
        setZoom(0);
        applyTransform(0, 0, 0, true);
        pinchEndedAtZeroRef.current = true;
      }
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
    const currentZoom = zoomRef.current;

    if (deltaTime > 150 && currentZoom > 0) {
      touchStartRef.current = null;
      dragStartRef.current = null;
      return;
    }

    const now = Date.now();
    if (deltaTime < 300 && absDeltaX < 10 && absDeltaY < 10) {
      if (now - lastTapTimeRef.current < 300) {
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        zoomRef.current = 0;
        panOffsetRef.current = { x: 0, y: 0 };
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
        applyTransform(0, 0, 0, true);
        lastTapTimeRef.current = 0;
        touchStartRef.current = null;
        dragStartRef.current = null;
        onDoubleTap?.();
        return;
      }
      lastTapTimeRef.current = now;
      touchStartRef.current = null;
      dragStartRef.current = null;
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        onSingleTap?.();
      }, 310);
      return;
    }

    if (currentZoom > 0 && absDeltaY > 50 && absDeltaY > absDeltaX) {
      const zoomSteps = Math.floor(absDeltaY / 100);

      if (deltaY > 0 && isUpperHalf) {
        const newZoom = Math.max(0, currentZoom - zoomSteps * 0.3);
        const finalZoom = newZoom < 0.3 ? 0 : newZoom;
        if (finalZoom === 0) {
          panOffsetRef.current = { x: 0, y: 0 };
          setPanOffset({ x: 0, y: 0 });
        }
        zoomRef.current = finalZoom;
        setZoom(finalZoom);
        setIsZooming(true);
        applyTransform(finalZoom, panOffsetRef.current.x, panOffsetRef.current.y, true);
        setTimeout(() => setIsZooming(false), 300);
        touchStartRef.current = null;
        dragStartRef.current = null;
        return;
      }

      if (deltaY < 0) {
        const newZoom = Math.min(1.5, currentZoom + zoomSteps * 0.3);
        zoomRef.current = newZoom;
        setZoom(newZoom);
        setIsZooming(true);
        applyTransform(newZoom, panOffsetRef.current.x, panOffsetRef.current.y, true);
        setTimeout(() => setIsZooming(false), 300);
        touchStartRef.current = null;
        dragStartRef.current = null;
        return;
      }
    }

    if (currentZoom > 0) {
      touchStartRef.current = null;
      dragStartRef.current = null;
      return;
    }

    if (absDeltaX > absDeltaY && absDeltaX > 50) {
      if (deltaX > 0 && hasPrev) {
        onNavigate('prev');
        zoomRef.current = 0;
        panOffsetRef.current = { x: 0, y: 0 };
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      } else if (deltaX < 0 && hasNext) {
        onNavigate('next');
        zoomRef.current = 0;
        panOffsetRef.current = { x: 0, y: 0 };
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      }
    } else if (absDeltaY > absDeltaX && absDeltaY > 50) {
      if (deltaY < 0) {
        const newZoom = 2.0;
        zoomRef.current = newZoom;
        setZoom(newZoom);
        setIsZooming(true);
        applyTransform(newZoom, 0, 0, true);
        setTimeout(() => setIsZooming(false), 300);
      }
    }

    touchStartRef.current = null;
    dragStartRef.current = null;
  }, [currentPhoto, hasPrev, hasNext, onNavigate, onSingleTap, onDoubleTap, applyTransform]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomRef.current <= 0) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: panOffsetRef.current.x,
      offsetY: panOffsetRef.current.y
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current || zoomRef.current <= 0) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    const newX = dragStartRef.current.offsetX + deltaX;
    const newY = dragStartRef.current.offsetY + deltaY;
    panOffsetRef.current = { x: newX, y: newY };
    applyTransform(zoomRef.current, newX, newY, false);
  }, [applyTransform]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      setPanOffset({ ...panOffsetRef.current });
    }
    isDraggingRef.current = false;
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touchStart = touchStartRef.current;
    if (!touchStart) return;

    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      const scale = distance / pinchStartRef.current.distance;
      const baseZoom = pinchStartRef.current.zoom === 0 ? 1 : pinchStartRef.current.zoom;
      let newZoom = Math.max(0, Math.min(3, baseZoom * scale - (pinchStartRef.current.zoom === 0 ? 1 : 0)));

      if (newZoom < 0.15) {
        newZoom = 0;
        panOffsetRef.current = { x: 0, y: 0 };
      }

      zoomRef.current = newZoom;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        applyTransform(newZoom, panOffsetRef.current.x, panOffsetRef.current.y, newZoom === 0);
      });
      return;
    }

    if (touchStart.touches > 1) return;

    if (isDraggingRef.current && dragStartRef.current && zoomRef.current > 0) {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;
      const newX = dragStartRef.current.offsetX + deltaX;
      const newY = dragStartRef.current.offsetY + deltaY;
      panOffsetRef.current = { x: newX, y: newY };

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        applyTransform(zoomRef.current, newX, newY, false);
      });
    }
  }, [applyTransform]);

  const resetZoom = useCallback(() => {
    zoomRef.current = 0;
    panOffsetRef.current = { x: 0, y: 0 };
    setZoom(0);
    setPanOffset({ x: 0, y: 0 });
    applyTransform(0, 0, 0, true);
  }, [applyTransform]);

  return {
    zoom,
    panOffset,
    isDragging,
    isZooming,
    imageRef,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetZoom
  };
};