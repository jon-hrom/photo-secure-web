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

    const handleStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
      isHorizontalSwipe = false;
    };

    const handleMove = (e: TouchEvent) => {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
      
      // Определяем направление свайпа только если движение больше 10px
      if (deltaX > 10 || deltaY > 10) {
        isHorizontalSwipe = deltaX > deltaY;
      }
    };

    const handleEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = Date.now() - touchStartTime.current;
      
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;
      
      // Свайп срабатывает только если:
      // 1. Движение было преимущественно горизонтальным
      // 2. Прошло меньше 500ms
      // 3. Горизонтальное смещение больше порога
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
    <div id="swipe-container" className="w-full h-full">
      {children}
    </div>
  );
};

export default SwipeContainer;