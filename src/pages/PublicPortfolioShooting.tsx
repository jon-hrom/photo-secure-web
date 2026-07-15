import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Lenis from '@studio-freight/lenis';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { Portfolio, PortfolioCategory, PortfolioShooting, getPublicPortfolio } from '@/lib/portfolioApi';
import PortfolioGallery from '@/components/portfolio/PortfolioGallery';
import { ZoomParallax } from '@/components/ui/zoom-parallax';

const PublicPortfolioShooting = () => {
  const { slug, category, shooting } = useParams<{ slug: string; category: string; shooting: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [cat, setCat] = useState<PortfolioCategory | null>(null);
  const [sh, setSh] = useState<PortfolioShooting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [onDark, setOnDark] = useState(true);
  const darkRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    getPublicPortfolio(slug)
      .then((p) => {
        if (!p) { setNotFound(true); return; }
        const foundCat = p.categories.find((c) => c.slug === category);
        const foundSh = (p.shootings || []).find((s) => s.slug === shooting && s.category_id === foundCat?.id);
        if (!foundCat || !foundSh) { setNotFound(true); return; }
        setPortfolio(p);
        setCat(foundCat);
        setSh(foundSh);
        document.title = `${foundSh.title} — ${p.title}`;
      })
      .finally(() => setLoading(false));
  }, [slug, category, shooting]);

  // Адаптивный цвет кнопки: тёмная над светлой галереей, светлая над тёмной секцией
  useEffect(() => {
    if (!showGrid) return;
    const BTN_Y = 40; // вертикальная позиция кнопки от верха
    const update = () => {
      const el = darkRef.current;
      if (!el) { setOnDark(false); return; }
      const rect = el.getBoundingClientRect();
      setOnDark(rect.bottom > BTN_Y);
    };
    update();
    const t = setTimeout(update, 100);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(t);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [showGrid, loading]);

  // Плавный скролл для эффекта параллакса (только при открытой съёмке)
  useEffect(() => {
    if (!showGrid) return;
    const lenis = new Lenis();
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [showGrid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800" />
      </div>
    );
  }

  if (notFound || !portfolio || !cat || !sh) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Icon name="ImageOff" size={48} className="text-gray-300" />
        <h1 className="text-xl font-semibold">Съёмка не найдена</h1>
        <button onClick={() => navigate(`/p/${slug}`)} className="text-sm text-gray-500 hover:text-gray-900 underline">
          Вернуться в портфолио
        </button>
      </div>
    );
  }

  const accent = portfolio.accent_color || '#7c3aed';
  const shPhotos = portfolio.photos.filter((p) => p.shooting_id === sh.id);
  const coverPhoto = sh.cover_url || shPhotos[0]?.photo_url || '';
  const backToCatalog = () => navigate(`/p/${slug}/${category}`);

  const parallaxImages = shPhotos.slice(0, 7).map((p) => ({
    src: getThumbUrl(p.photo_url, 1600) || p.photo_url,
    alt: sh.title,
  }));
  const showParallax = parallaxImages.length >= 3;

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ ['--accent' as string]: accent }}>
      {!showGrid ? (
        // Экран-обложка съёмки
        <div className="relative h-screen w-full overflow-hidden">
          {coverPhoto && (
            <img src={getThumbUrl(coverPhoto, 2560) || coverPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />

          <button
            onClick={backToCatalog}
            className="absolute top-5 left-5 z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition text-sm"
          >
            <Icon name="ArrowLeft" size={16} /> {cat.title}
          </button>

          <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
            <span className="text-xs sm:text-sm tracking-[0.3em] uppercase text-white/60 mb-4">{cat.title}</span>
            <h1 className="text-4xl sm:text-7xl font-light tracking-[0.15em] uppercase drop-shadow-lg">{sh.title}</h1>
            <p className="text-white/70 mt-4 tracking-wider">{shPhotos.length} фотографий</p>
            {shPhotos.length > 0 && (
              <button
                onClick={() => setShowGrid(true)}
                className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition hover:opacity-90"
                style={{ background: accent }}
              >
                Открыть съёмку <Icon name="ArrowRight" size={18} />
              </button>
            )}
          </div>
        </div>
      ) : (
        // Съёмка: параллакс + галерея
        <>
          {/* Плавающая панель управления */}
          <div className="fixed top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
            <button
              onClick={backToCatalog}
              className={`pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur transition text-sm ${
                onDark
                  ? 'bg-black/40 hover:bg-black/60 text-white'
                  : 'bg-white/70 hover:bg-white/90 text-gray-900 shadow-sm'
              }`}
            >
              <Icon name="ArrowLeft" size={16} className={onDark ? 'text-white' : 'text-gray-900'} /> <span className="hidden sm:inline">К съёмкам</span>
            </button>
          </div>

          {showParallax && (
            <div ref={darkRef} className="bg-black text-white">
              <div className="relative flex h-[60vh] items-center justify-center text-center px-6">
                <div>
                  <h1 className="text-4xl sm:text-6xl font-light tracking-[0.15em] uppercase">{sh.title}</h1>
                  <p className="text-white/50 mt-4 tracking-wider flex items-center justify-center gap-2">
                    Листайте вниз <Icon name="ChevronDown" size={16} />
                  </p>
                </div>
              </div>
              <ZoomParallax images={parallaxImages} />
            </div>
          )}

          <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-10 pb-16">
            {!showParallax && (
              <div className="flex items-center gap-3 mb-6 pt-4">
                <h2 className="text-lg sm:text-2xl font-light tracking-widest uppercase truncate">{sh.title}</h2>
                <span className="text-sm text-gray-500 shrink-0">· {shPhotos.length} фото</span>
              </div>
            )}
            {showParallax && (
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-lg sm:text-2xl font-light tracking-widest uppercase">Все фотографии</h2>
                <span className="text-sm text-gray-500 shrink-0">· {shPhotos.length}</span>
              </div>
            )}
            <PortfolioGallery photos={shPhotos} accent={accent} />
          </div>
        </>
      )}
    </div>
  );
};

export default PublicPortfolioShooting;