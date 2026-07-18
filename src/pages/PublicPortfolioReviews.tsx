import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Portfolio, getPublicPortfolio } from '@/lib/portfolioApi';
import PortfolioNav from '@/components/portfolio/PortfolioNav';
import ReviewCard from '@/components/portfolio/ReviewCard';
import ReviewFormDialog from '@/components/portfolio/ReviewFormDialog';

const PublicPortfolioReviews = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getPublicPortfolio(slug)
      .then((p) => {
        if (!p) setNotFound(true);
        else {
          setPortfolio(p);
          document.title = `Отзывы — ${p.title || 'Портфолио фотографа'}`;
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const openCategory = useCallback((catSlug: string) => {
    navigate(`/p/${slug}/${catSlug}`);
  }, [navigate, slug]);

  const onNav = useCallback((id: string) => {
    if (id === 'top') { navigate(`/p/${slug}`); return; }
    if (id === 'reviews') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (id === 'contacts') { navigate(`/p/${slug}/kontakty`); return; }
  }, [navigate, slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800" />
      </div>
    );
  }

  if (notFound || !portfolio) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Icon name="ImageOff" size={48} className="text-gray-300" />
        <h1 className="text-xl font-semibold">Портфолио не найдено</h1>
        <p className="text-gray-500 text-sm">Возможно, ссылка устарела или портфолио ещё не опубликовано.</p>
      </div>
    );
  }

  const accent = portfolio.accent_color || '#7c3aed';
  const logo = portfolio.logo_text || portfolio.title || 'PORTFOLIO';
  const reviews = portfolio.reviews || [];
  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length)
    : 0;

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ ['--accent' as string]: accent }}>
      <div className="relative bg-black text-white">
        <PortfolioNav
          logo={logo}
          categories={portfolio.categories}
          position={portfolio.menu_position || 'top-right'}
          showReviews={portfolio.show_reviews && reviews.length > 0}
          showAbout={portfolio.show_about}
          onOpenCategory={openCategory}
          onScrollTo={onNav}
        />
        <div className="min-h-[44vh] py-24 flex flex-col items-center justify-center text-center px-6">
          <span className="text-xs sm:text-sm tracking-[0.3em] uppercase text-white/50 mb-4">{portfolio.title}</span>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-light tracking-tight max-w-3xl leading-tight">
            Доверие, которое вдохновляет
          </h1>

          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-6 text-white/80">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Icon key={n} name="Star" size={17} className={n <= Math.round(avg) ? 'text-amber-400' : 'text-white/25'} fill={n <= Math.round(avg) ? '#fbbf24' : 'none'} />
                ))}
              </div>
              <span className="text-sm">{avg.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'отзыв' : reviews.length < 5 ? 'отзыва' : 'отзывов'}</span>
            </div>
          )}

          <button
            onClick={() => setFormOpen(true)}
            className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white font-medium text-sm tracking-wide transition-transform hover:scale-105 shadow-lg"
            style={{ background: accent }}
          >
            <Icon name="Heart" size={18} /> Оставить эмоции
          </button>
        </div>
      </div>

      <section className="py-16 sm:py-24 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto">
          {reviews.length === 0 ? (
            <div className="text-center py-10">
              <Icon name="MessageСircleHeart" fallback="Heart" size={44} className="mx-auto text-gray-200 mb-4" />
              <p className="text-gray-400 mb-6">Пока нет отзывов. Станьте первым, кто поделится эмоциями!</p>
              <button
                onClick={() => setFormOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-medium"
                style={{ background: accent }}
              >
                <Icon name="Heart" size={16} /> Оставить эмоции
              </button>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [column-fill:_balance]">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} accent={accent} onPhotoClick={setLightbox} />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="text-center text-gray-400 text-xs py-8 border-t border-gray-200 tracking-widest uppercase">
        {portfolio.title}
      </footer>

      <ReviewFormDialog open={formOpen} onClose={() => setFormOpen(false)} slug={slug || ''} accent={accent} />

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-5 right-5 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <Icon name="X" size={30} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default PublicPortfolioReviews;
