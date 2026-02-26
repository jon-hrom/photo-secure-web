import { useRef, useEffect, ReactNode } from 'react';

interface SwipeContainerProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

const SwipeContainer = ({ 
  children, 
  onSwipeLeft, 
  onSwipeRight, 
  threshold = 50 
}: SwipeContainerProps) => {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  useEffect(() => {
    const element = document.getElementById('swipe-container');
    if (!element) return;

    let isHorizontalSwipe = false;
    let swipeDecided = false;

    const handleStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
      isHorizontalSwipe = false;
      swipeDecided = false;
    };

    const handleMove = (e: TouchEvent) => {
      if (swipeDecided) return;
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (deltaX > 10 || deltaY > 10) {
        isHorizontalSwipe = deltaX > deltaY * 1.5;
        swipeDecided = true;
      }
    };

    const handleEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchDuration = Date.now() - touchStartTime.current;
      const deltaX = touchEndX - touchStartX.current;

      if (!isHorizontalSwipe) return;
      if (touchDuration > 500) return;
      if (Math.abs(deltaX) < threshold) return;

      if (deltaX > 0 && onSwipeRight) {
        vibrate([10, 5, 10]);
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        vibrate([10, 5, 10]);
        onSwipeLeft();
      }
    };

    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchmove', handleMove, { passive: true });
    element.addEventListener('touchend', handleEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return (
    <div id="swipe-container" className="w-full h-full" style={{ touchAction: 'pan-y' }}>
      {children}
    </div>
  );
};

export default SwipeContainer;