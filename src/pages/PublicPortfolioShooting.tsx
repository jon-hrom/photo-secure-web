import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { Portfolio, PortfolioCategory, PortfolioShooting, getPublicPortfolio } from '@/lib/portfolioApi';
import PortfolioGallery from '@/components/portfolio/PortfolioGallery';

const PublicPortfolioShooting = () => {
  const { slug, category, shooting } = useParams<{ slug: string; category: string; shooting: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [cat, setCat] = useState<PortfolioCategory | null>(null);
  const [sh, setSh] = useState<PortfolioShooting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  if (notFound || !portfolio || !cat || !sh) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Icon name="ImageOff" size={48} className="text-gray-600" />
        <h1 className="text-xl font-semibold">Съёмка не найдена</h1>
        <button onClick={() => navigate(`/p/${slug}`)} className="text-sm text-white/60 hover:text-white underline">
          Вернуться в портфолио
        </button>
      </div>
    );
  }

  const accent = portfolio.accent_color || '#7c3aed';
  const shPhotos = portfolio.photos.filter((p) => p.shooting_id === sh.id);
  const coverPhoto = sh.cover_url || shPhotos[0]?.photo_url || '';
  const backToCatalog = () => navigate(`/p/${slug}/${category}`);

  return (
    <div className="min-h-screen bg-black text-white" style={{ ['--accent' as string]: accent }}>
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
        // Сетка фото съёмки
        <>
          <div className="sticky top-0 z-20 flex items-center justify-between px-5 sm:px-8 py-4 bg-black/90 backdrop-blur border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setShowGrid(false)} className="p-1.5 rounded-full hover:bg-white/10 transition shrink-0">
                <Icon name="ArrowLeft" size={22} className="text-white" />
              </button>
              <h2 className="text-lg sm:text-2xl font-light tracking-widest uppercase truncate">{sh.title}</h2>
              <span className="text-sm text-white/50 shrink-0">· {shPhotos.length} фото</span>
            </div>
            <button onClick={backToCatalog} className="p-1.5 rounded-full hover:bg-white/10 transition shrink-0" title="К съёмкам">
              <Icon name="LayoutGrid" size={20} className="text-white" />
            </button>
          </div>

          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8">
            <PortfolioGallery photos={shPhotos} accent={accent} />
          </div>
        </>
      )}
    </div>
  );
};

export default PublicPortfolioShooting;
