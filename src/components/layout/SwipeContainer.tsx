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

    const handleStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
    };

    const handleEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = Date.now() - touchStartTime.current;
      
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;
      
      if (touchDuration > 500) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;
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
    element.addEventListener('touchend', handleEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchend', handleEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return (
    <div id="swipe-container" className="w-full h-full">
      {children}
    </div>
  );
};

export default SwipeContainer;