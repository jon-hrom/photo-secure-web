import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { Portfolio, PortfolioCategory, getPublicPortfolio } from '@/lib/portfolioApi';
import PortfolioGallery from '@/components/portfolio/PortfolioGallery';

const PublicPortfolioCategory = () => {
  const { slug, category } = useParams<{ slug: string; category: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [cat, setCat] = useState<PortfolioCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getPublicPortfolio(slug)
      .then((p) => {
        if (!p) { setNotFound(true); return; }
        const found = p.categories.find((c) => c.slug === category);
        if (!found) { setNotFound(true); return; }
        setPortfolio(p);
        setCat(found);
        document.title = `${found.title} — ${p.title}`;
      })
      .finally(() => setLoading(false));
  }, [slug, category]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  if (notFound || !portfolio || !cat) {
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
  const catPhotos = portfolio.photos.filter((p) => p.category_id === cat.id);
  const coverPhoto = cat.cover_url || catPhotos[0]?.photo_url || '';

  return (
    <div className="min-h-screen bg-black text-white" style={{ ['--accent' as string]: accent }}>
      {!showGrid ? (
        // Экран-обложка съёмки
        <div className="relative h-screen w-full overflow-hidden">
          {coverPhoto && (
            <img src={getThumbUrl(coverPhoto, 2560) || coverPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />

          {/* Назад */}
          <button
            onClick={() => navigate(`/p/${slug}`)}
            className="absolute top-5 left-5 z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition text-sm"
          >
            <Icon name="ArrowLeft" size={16} /> В портфолио
          </button>

          <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
            <span className="text-xs sm:text-sm tracking-[0.3em] uppercase text-white/60 mb-4">Съёмка</span>
            <h1 className="text-4xl sm:text-7xl font-light tracking-[0.15em] uppercase drop-shadow-lg">{cat.title}</h1>
            <p className="text-white/70 mt-4 tracking-wider">{catPhotos.length} фотографий</p>
            {catPhotos.length > 0 && (
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
              <h2 className="text-lg sm:text-2xl font-light tracking-widest uppercase truncate">{cat.title}</h2>
              <span className="text-sm text-white/50 shrink-0">· {catPhotos.length} фото</span>
            </div>
            <button onClick={() => navigate(`/p/${slug}`)} className="p-1.5 rounded-full hover:bg-white/10 transition shrink-0" title="В портфолио">
              <Icon name="Home" size={20} className="text-white" />
            </button>
          </div>

          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8">
            <PortfolioGallery photos={catPhotos} accent={accent} />
          </div>
        </>
      )}
    </div>
  );
};

export default PublicPortfolioCategory;
