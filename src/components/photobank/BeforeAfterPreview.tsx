import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';

interface BeforeAfterPreviewProps {
  src: string;
  filterStr: string;
  retouchedSrc?: string;
}

const BeforeAfterPreview = ({ src, filterStr, retouchedSrc }: BeforeAfterPreviewProps) => {
  console.log('[BEFORE_AFTER] src:', src?.substring(0, 80), 'retouchedSrc:', retouchedSrc?.substring(0, 80));
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [afterState, setAfterState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const dragging = useRef(false);

  useEffect(() => {
    setImgState('loading');
  }, [src]);

  useEffect(() => {
    if (retouchedSrc) setAfterState('loading');
  }, [retouchedSrc]);

  const imgLoaded = imgState === 'loaded';
  const afterLoaded = afterState === 'loaded';
  const hasRetouched = !!retouchedSrc;

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    containerRef.current?.setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  if (!src) {
    return (
      <div className="rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center h-48 sm:h-64">
        <div className="text-center text-muted-foreground">
          <Icon name="ImageOff" size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs">RAW-файл без превью</p>
          <p className="text-[10px] mt-1 opacity-70">Выберите JPG/PNG фото</p>
        </div>
      </div>
    );
  }

  const imgClass = 'w-full h-auto max-h-[40vh] sm:max-h-[50vh] lg:max-h-[55vh] object-contain';

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden bg-black border border-border/50 select-none touch-none cursor-col-resize"
      onPointerDown={imgLoaded ? onPointerDown : undefined}
      onPointerMove={imgLoaded ? onPointerMove : undefined}
      onPointerUp={imgLoaded ? onPointerUp : undefined}
      style={{ WebkitUserSelect: 'none' }}
    >
      {imgState === 'loading' && (
        <div className="flex items-center justify-center h-48 sm:h-64">
          <Icon name="Loader2" size={24} className="animate-spin text-white/50" />
        </div>
      )}

      {imgState === 'error' && (
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="text-center text-white/60">
            <Icon name="ImageOff" size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">Не удалось загрузить</p>
          </div>
        </div>
      )}

      <img
        src={src}
        alt=""
        className={`${imgClass} ${imgLoaded ? '' : 'hidden'}`}
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        draggable={false}
        onLoad={() => setImgState('loaded')}
        onError={() => setImgState('error')}
      />

      {imgLoaded && hasRetouched && (
        <>
          <img
            src={retouchedSrc}
            alt=""
            className={`absolute inset-0 ${imgClass} ${afterLoaded ? '' : 'hidden'}`}
            style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
            draggable={false}
            onLoad={() => { console.log('[BEFORE_AFTER] After image LOADED'); setAfterState('loaded'); }}
            onError={() => { console.error('[BEFORE_AFTER] After image ERROR, url:', retouchedSrc); setAfterState('error'); }}
          />
          {!afterLoaded && afterState === 'loading' && (
            <img
              src={src}
              alt=""
              className={`absolute inset-0 ${imgClass}`}
              style={{
                filter: filterStr,
                transition: 'filter 0.1s ease',
                clipPath: `inset(0 0 0 ${sliderPos}%)`,
              }}
              draggable={false}
            />
          )}
        </>
      )}

      {imgLoaded && !hasRetouched && (
        <img
          src={src}
          alt=""
          className={`absolute inset-0 ${imgClass}`}
          style={{
            filter: filterStr,
            transition: 'filter 0.1s ease',
            clipPath: `inset(0 0 0 ${sliderPos}%)`,
          }}
          draggable={false}
        />
      )}

      {imgLoaded && (
        <>
          <div
            className="absolute top-0 bottom-0 z-10"
            style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-0.5 h-full bg-white/90 mx-auto" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white shadow-md flex items-center justify-center">
              <Icon name="ArrowLeftRight" size={12} className="text-gray-700" />
            </div>
          </div>

          <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm pointer-events-none z-20">
            До
          </div>
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm pointer-events-none z-20">
            После
            {hasRetouched && afterLoaded && (
              <Icon name="Sparkles" size={10} className="text-amber-400" />
            )}
            {hasRetouched && afterState === 'loading' && (
              <Icon name="Loader2" size={10} className="animate-spin" />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BeforeAfterPreview;