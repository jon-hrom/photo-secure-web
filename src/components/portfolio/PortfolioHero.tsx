import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { PortfolioPhoto } from '@/lib/portfolioApi';

interface Props {
  photos: PortfolioPhoto[];
  mobilePhotos?: PortfolioPhoto[];
  title: string;
  subtitle: string;
  autoplay: boolean;
  onCornerTone?: (tone: 'light' | 'dark') => void;
}

const PortfolioHero = ({ photos: desktopPhotos, mobilePhotos, title, subtitle, autoplay, onCornerTone }: Props) => {
  const [index, setIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // На телефоне показываем вертикальные фото слайдера, если они загружены.
  const useMobile = isMobile && !!mobilePhotos && mobilePhotos.length > 0;
  const photos = useMobile ? mobilePhotos! : desktopPhotos;

  useEffect(() => {
    setIndex(0);
  }, [useMobile]);

  // Определяем яркость левого-верхнего угла текущего фото, чтобы подстроить цвет логотипа-рамки
  const currentUrl = photos[index]?.photo_url;
  useEffect(() => {
    if (!currentUrl || !onCornerTone) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const cw = 24, ch = 24;
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Берём именно левый-верхний угол исходного фото
        const sample = Math.min(img.naturalWidth, img.naturalHeight) * 0.28 || 100;
        ctx.drawImage(img, 0, 0, sample, sample, 0, 0, cw, ch);
        const { data } = ctx.getImageData(0, 0, cw, ch);
        let sum = 0;
        for (let p = 0; p < data.length; p += 4) {
          sum += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
        }
        let lum = sum / (data.length / 4);
        // Сверху лежит затемняющий градиент (~40% чёрного) — учитываем его
        lum *= 0.6;
        onCornerTone(lum > 140 ? 'light' : 'dark');
      } catch {
        onCornerTone('dark');
      }
    };
    img.onerror = () => !cancelled && onCornerTone('dark');
    img.src = getThumbUrl(currentUrl, 200) || currentUrl;
    return () => { cancelled = true; };
  }, [currentUrl, onCornerTone]);

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

  const imgWidth = isMobile ? 1080 : 2560;

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black">
      {photos.map((p, i) => (
        <img
          key={p.id}
          src={getThumbUrl(p.photo_url, imgWidth) || p.photo_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
          draggable={false}
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding="async"
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