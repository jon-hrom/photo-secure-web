import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { PortfolioPhoto } from '@/lib/portfolioApi';

interface Props {
  photos: PortfolioPhoto[];
  accent: string;
}

const PortfolioGallery = ({ photos, accent }: Props) => {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(() => setIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)), [photos.length]);
  const next = useCallback(() => setIndex((i) => (i === null ? null : (i + 1) % photos.length)), [photos.length]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, close, prev, next]);

  if (photos.length === 0) {
    return <p className="text-center text-gray-500 py-12">В этой категории пока нет фото</p>;
  }

  return (
    <>
      <div className="columns-2 sm:columns-3 gap-2 sm:gap-3 [column-fill:_balance]">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setIndex(i)}
            className="mb-2 sm:mb-3 block w-full overflow-hidden rounded-xl group relative"
          >
            <img
              src={p.grid_thumbnail_url || getThumbUrl(p.photo_url, 600) || p.thumbnail_url}
              alt=""
              loading="lazy"
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
              <Icon name="Maximize2" size={22} className="text-white opacity-0 group-hover:opacity-100 transition" />
            </div>
          </button>
        ))}
      </div>

      {index !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={close}>
          <button className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20" onClick={close}>
            <Icon name="X" size={24} className="text-white" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); prev(); }}
              >
                <Icon name="ChevronLeft" size={26} className="text-white" />
              </button>
              <button
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); next(); }}
              >
                <Icon name="ChevronRight" size={26} className="text-white" />
              </button>
            </>
          )}
          <img
            src={getThumbUrl(photos[index].photo_url, 2048) || photos[index].photo_url}
            alt=""
            className="max-w-[95vw] max-h-[92vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm px-3 py-1 rounded-full bg-white/10" style={{ borderColor: accent }}>
            {index + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  );
};

export default PortfolioGallery;
