import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { PortfolioPhoto } from '@/lib/portfolioApi';

interface Props {
  photos: PortfolioPhoto[];
  onClose: () => void;
}

const PortfolioSlideshow = ({ photos, onClose }: Props) => {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const next = useCallback(() => setIndex((i) => (i + 1) % photos.length), [photos.length]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    if (!playing || photos.length < 2) return;
    const t = setInterval(next, 4000);
    return () => clearInterval(t);
  }, [playing, next, photos.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  if (photos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
      <button className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20" onClick={onClose}>
        <Icon name="X" size={24} className="text-white" />
      </button>

      {photos.map((p, i) => (
        <img
          key={p.id}
          src={getThumbUrl(p.photo_url, 2048) || p.photo_url}
          alt=""
          className="absolute max-w-[96vw] max-h-[90vh] object-contain transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}

      <button className="absolute left-3 sm:left-8 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20" onClick={prev}>
        <Icon name="ChevronLeft" size={28} className="text-white" />
      </button>
      <button className="absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20" onClick={next}>
        <Icon name="ChevronRight" size={28} className="text-white" />
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
        <button onClick={() => setPlaying((p) => !p)} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
          <Icon name={playing ? 'Pause' : 'Play'} size={20} className="text-white" />
        </button>
        <span className="text-white/70 text-sm">{index + 1} / {photos.length}</span>
      </div>
    </div>
  );
};

export default PortfolioSlideshow;
