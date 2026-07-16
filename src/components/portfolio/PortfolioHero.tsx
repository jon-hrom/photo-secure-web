import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { PortfolioPhoto } from '@/lib/portfolioApi';

interface Props {
  photos: PortfolioPhoto[];
  title: string;
  subtitle: string;
  autoplay: boolean;
}

const PortfolioHero = ({ photos, title, subtitle, autoplay }: Props) => {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => setIndex((i) => (i + 1) % Math.max(photos.length, 1)), [photos.length]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + photos.length) % Math.max(photos.length, 1)), [photos.length]);

  useEffect(() => {
    if (!autoplay || photos.length < 2) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [autoplay, next, photos.length]);

  if (photos.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-4xl sm:text-6xl font-light tracking-wide">{title}</h1>
        {subtitle && <p className="text-lg text-white/70 mt-3">{subtitle}</p>}
      </div>
    );
  }

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black">
      {photos.map((p, i) => (
        <img
          key={p.id}
          src={getThumbUrl(p.photo_url, 2560) || p.photo_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
          draggable={false}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />

      {/* Заголовок */}
      <div className="absolute bottom-16 left-0 right-0 text-center px-6 pointer-events-none">
        <h1 className="text-3xl sm:text-6xl font-light tracking-[0.15em] uppercase drop-shadow-lg">{title}</h1>
        {subtitle && <p className="text-base sm:text-xl text-white/80 mt-3 tracking-wider drop-shadow">{subtitle}</p>}
      </div>

      {/* Навигация слайдера */}
      {photos.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur flex items-center justify-center transition"
          >
            <Icon name="ChevronLeft" size={24} className="text-white" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur flex items-center justify-center transition"
          >
            <Icon name="ChevronRight" size={24} className="text-white" />
          </button>
        </>
      )}
    </section>
  );
};

export default PortfolioHero;