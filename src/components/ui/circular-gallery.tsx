import React, { useState, useEffect, useRef, HTMLAttributes } from 'react';

const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

export interface GalleryItem {
  title: string;
  subtitle?: string;
  imageUrl: string;
  pos?: string;
  onClick?: () => void;
}

interface CircularGalleryProps extends HTMLAttributes<HTMLDivElement> {
  items: GalleryItem[];
  radius?: number;
  autoRotateSpeed?: number;
}

const CircularGallery = React.forwardRef<HTMLDivElement, CircularGalleryProps>(
  ({ items, className, radius = 600, autoRotateSpeed = 0.02, ...props }, ref) => {
    const [rotation, setRotation] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
      const check = () => setIsMobile(window.innerWidth < 640);
      check();
      window.addEventListener('resize', check);
      return () => window.removeEventListener('resize', check);
    }, []);

    // Радиус считаем из числа карточек и их ширины: расстояние между центрами соседних
    // карточек = 2*R*sin(π/N). Чтобы они не налезали, это расстояние должно быть больше
    // ширины карточки + зазор. Значит круг автоматически расширяется, когда карточек больше.
    const n = Math.max(items.length, 1);
    const cardWidth = isMobile ? 160 : 300;
    const gap = isMobile ? 40 : 80;
    const minRadius = n >= 2 ? (cardWidth + gap) / (2 * Math.sin(Math.PI / n)) : 0;
    const baseRadius = isMobile ? 320 : radius;
    const effectiveRadius = Math.max(baseRadius, Math.ceil(minRadius));
    const [isScrolling, setIsScrolling] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const dragStartX = useRef(0);
    const dragStartRotation = useRef(0);
    const draggingRef = useRef(false);
    const movedRef = useRef(false);

    useEffect(() => {
      const handleScroll = () => {
        if (draggingRef.current) return;
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
        setRotation(scrollProgress * 360);

        scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 150);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        window.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      };
    }, []);

    useEffect(() => {
      const autoRotate = () => {
        if (!isScrolling && !isDragging) setRotation((prev) => prev + autoRotateSpeed);
        animationFrameRef.current = requestAnimationFrame(autoRotate);
      };
      animationFrameRef.current = requestAnimationFrame(autoRotate);
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }, [isScrolling, isDragging, autoRotateSpeed]);

    const dragStart = (clientX: number) => {
      draggingRef.current = true;
      movedRef.current = false;
      setIsDragging(true);
      dragStartX.current = clientX;
      dragStartRotation.current = rotation;
    };

    const dragMove = (clientX: number) => {
      if (!draggingRef.current) return;
      const delta = clientX - dragStartX.current;
      if (Math.abs(delta) > 6) movedRef.current = true;
      setRotation(dragStartRotation.current + delta * 0.4);
    };

    const dragEnd = () => {
      draggingRef.current = false;
      setIsDragging(false);
    };

    const anglePerItem = items.length > 0 ? 360 / items.length : 0;

    return (
      <div
        ref={ref}
        role="region"
        aria-label="Круговая 3D-галерея"
        className={cn(
          'relative w-full h-full flex items-center justify-center touch-pan-y select-none',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
          className
        )}
        style={{ perspective: '2000px' }}
        onTouchStart={(e) => dragStart(e.touches[0].clientX)}
        onTouchMove={(e) => dragMove(e.touches[0].clientX)}
        onTouchEnd={dragEnd}
        onTouchCancel={dragEnd}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') dragStart(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') dragMove(e.clientX);
        }}
        onPointerUp={dragEnd}
        onPointerLeave={dragEnd}
        {...props}
      >
        <div
          className="relative w-full h-full"
          style={{ transform: `rotateY(${rotation}deg)`, transformStyle: 'preserve-3d' }}
        >
          {items.map((item, i) => {
            const itemAngle = i * anglePerItem;
            const totalRotation = rotation % 360;
            const relativeAngle = (itemAngle + totalRotation + 360) % 360;
            const normalizedAngle = Math.abs(relativeAngle > 180 ? 360 - relativeAngle : relativeAngle);
            const opacity = Math.max(0.3, 1 - normalizedAngle / 180);

            return (
              <button
                key={`${item.title}-${i}`}
                type="button"
                onClick={() => {
                  if (movedRef.current) return;
                  item.onClick?.();
                }}
                aria-label={item.title}
                className="absolute w-[160px] h-[214px] sm:w-[300px] sm:h-[400px] cursor-pointer"
                style={{
                  transform: `rotateY(${itemAngle}deg) translateZ(${effectiveRadius}px)`,
                  left: '50%',
                  top: '50%',
                  marginLeft: isMobile ? '-80px' : '-150px',
                  marginTop: isMobile ? '-107px' : '-200px',
                  opacity,
                  transition: 'opacity 0.3s linear',
                }}
              >
                <div className="relative w-full h-full rounded-lg shadow-2xl overflow-hidden group border border-black/5 bg-white/70 backdrop-blur-lg">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ objectPosition: item.pos || 'center' }}
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gray-100" />
                  )}
                  <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent text-white text-left">
                    <h2 className="text-lg sm:text-xl font-medium tracking-wide">{item.title}</h2>
                    {item.subtitle && <p className="text-xs mt-1 opacity-80">{item.subtitle}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);

CircularGallery.displayName = 'CircularGallery';

export { CircularGallery };