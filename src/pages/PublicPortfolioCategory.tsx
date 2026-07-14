import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { Portfolio, PortfolioCategory, getPublicPortfolio } from '@/lib/portfolioApi';

const PublicPortfolioCategory = () => {
  const { slug, category } = useParams<{ slug: string; category: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [cat, setCat] = useState<PortfolioCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        <h1 className="text-xl font-semibold">Категория не найдена</h1>
        <button onClick={() => navigate(`/p/${slug}`)} className="text-sm text-white/60 hover:text-white underline">
          Вернуться в портфолио
        </button>
      </div>
    );
  }

  const accent = portfolio.accent_color || '#7c3aed';
  const shootings = (portfolio.shootings || []).filter((s) => s.category_id === cat.id);

  const coverFor = (shootingId: number, cover: string) => {
    if (cover) return getThumbUrl(cover, 900) || cover;
    const p = portfolio.photos.find((ph) => ph.shooting_id === shootingId);
    return p ? (getThumbUrl(p.photo_url, 900) || p.grid_thumbnail_url || p.photo_url) : '';
  };
  const countFor = (shootingId: number) => portfolio.photos.filter((ph) => ph.shooting_id === shootingId).length;

  const visibleShootings = shootings.filter((s) => countFor(s.id) > 0);

  return (
    <div className="min-h-screen bg-black text-white" style={{ ['--accent' as string]: accent }}>
      {/* Шапка */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 sm:px-8 py-4 bg-black/90 backdrop-blur border-b border-white/10">
        <button onClick={() => navigate(`/p/${slug}`)} className="inline-flex items-center gap-2 text-sm hover:text-white/70 transition">
          <Icon name="ArrowLeft" size={18} /> В портфолио
        </button>
        <h1 className="text-lg sm:text-2xl font-light tracking-widest uppercase truncate">{cat.title}</h1>
        <div className="w-24 hidden sm:block" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        <p className="text-center text-white/50 mb-10 tracking-wider">
          {visibleShootings.length > 0 ? 'Выберите съёмку' : ''}
        </p>

        {visibleShootings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {visibleShootings.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/p/${slug}/${category}/${s.slug}`)}
                className="group text-center"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
                  {coverFor(s.id, s.cover_url) ? (
                    <img
                      src={coverFor(s.id, s.cover_url)}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-white/5" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition" style={{ color: '#fff' }}>
                      Смотреть <Icon name="ArrowRight" size={14} />
                    </span>
                  </div>
                </div>
                <div className="mt-4 text-lg sm:text-xl font-medium tracking-widest uppercase">{s.title}</div>
                <div className="text-sm text-white/50 mt-1">{countFor(s.id)} фото</div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-white/50 py-20">В этой категории пока нет съёмок</p>
        )}
      </div>
    </div>
  );
};

export default PublicPortfolioCategory;
