import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Portfolio, getPublicPortfolio } from '@/lib/portfolioApi';
import PortfolioNav from '@/components/portfolio/PortfolioNav';

const PublicPortfolioReviews = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        <div className="h-[38vh] min-h-[260px] flex flex-col items-center justify-center text-center px-6">
          <span className="text-xs sm:text-sm tracking-[0.3em] uppercase text-white/50 mb-3">{portfolio.title}</span>
          <h1 className="text-4xl sm:text-6xl font-light tracking-[0.15em] uppercase">Отзывы</h1>
        </div>
      </div>

      <section className="py-16 sm:py-24 px-6">
        <div className="max-w-5xl mx-auto">
          {reviews.length === 0 ? (
            <p className="text-center text-gray-400">Пока нет отзывов.</p>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [column-fill:_balance]">
              {reviews.map((r) => (
                <div key={r.id} className="mb-5 break-inside-avoid rounded-2xl bg-gray-50 border border-gray-200 p-6 text-center">
                  <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center font-semibold text-lg mb-3 text-white" style={{ background: accent }}>
                    {r.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-medium text-lg">{r.author_name}</div>
                  <div className="text-amber-500 text-sm my-2">{'★'.repeat(r.rating)}<span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span></div>
                  <p className="text-gray-600 text-sm leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="text-center text-gray-400 text-xs py-8 border-t border-gray-200 tracking-widest uppercase">
        {portfolio.title}
      </footer>
    </div>
  );
};

export default PublicPortfolioReviews;
