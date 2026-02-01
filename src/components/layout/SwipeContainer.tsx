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
      console.log('SwipeContainer: Touch start', { x: touchStartX.current, y: touchStartY.current });
    };

    const handleMove = (e: TouchEvent) => {
      if (swipeDecided) return;
      
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
      
      console.log('SwipeContainer: Move', { deltaX, deltaY });
      
      // Определяем направление только если движение больше 15px
      if (deltaX > 15 || deltaY > 15) {
        isHorizontalSwipe = deltaX > deltaY * 1.5; // Более строгий порог
        swipeDecided = true;
        console.log('SwipeContainer: Direction decided', { isHorizontalSwipe });
      }
    };

    const handleEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = Date.now() - touchStartTime.current;
      
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;
      
      console.log('SwipeContainer: Touch end', { 
        deltaX, 
        deltaY, 
        duration: touchDuration, 
        isHorizontalSwipe 
      });
      
      if (!isHorizontalSwipe) {
        console.log('SwipeContainer: Vertical scroll, ignoring');
        return;
      }
      if (touchDuration > 500) return;
      if (Math.abs(deltaX) < threshold) return;
      
      if (deltaX > 0 && onSwipeRight) {
        console.log('SwipeContainer: Swipe RIGHT');
        vibrate([10, 5, 10]);
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        console.log('SwipeContainer: Swipe LEFT');
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