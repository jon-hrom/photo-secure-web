import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';

interface FullscreenImageProps {
  imageUrl: string;
  onClose: () => void;
}

export default function FullscreenImage({ imageUrl, onClose }: FullscreenImageProps) {
  const [scale, setScale] = useState(1);
  const [lastDistance, setLastDistance] = useState(0);

  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.body.style.overflow = 'hidden';
    document.addEventListener('gesturestart', preventDefault);
    document.addEventListener('gesturechange', preventDefault);
    document.addEventListener('gestureend', preventDefault);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('gesturestart', preventDefault);
      document.removeEventListener('gesturechange', preventDefault);
      document.removeEventListener('gestureend', preventDefault);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      if (lastDistance > 0) {
        const newScale = scale * (distance / lastDistance);
        setScale(Math.min(Math.max(1, newScale), 4));
      }
      setLastDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setLastDistance(0);
  };

  const handleDoubleClick = () => {
    setScale(scale === 1 ? 2 : 1);
  };

  return (
    <div 
      className="fixed inset-0 bg-black z-[100] flex items-center justify-center"
      onClick={onClose}
      style={{ 
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <button
        onClick={onClose}
        type="button"
        className="absolute z-10 p-3 sm:p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors touch-manipulation backdrop-blur-sm"
        style={{ 
          top: 'max(1rem, env(safe-area-inset-top))',
          right: '1rem'
        }}
      >
        <Icon name="X" size={28} className="text-white sm:w-6 sm:h-6" />
      </button>
      
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={imageUrl} 
          alt="Полноэкранное изображение" 
          className="max-w-full max-h-full object-contain p-4 transition-transform duration-200"
          onDoubleClick={handleDoubleClick}
          style={{
            transform: `scale(${scale})`,
            maxWidth: '100vw',
            maxHeight: '100vh',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            cursor: scale > 1 ? 'zoom-out' : 'zoom-in'
          }}
        />
      </div>
      
      {scale > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}
