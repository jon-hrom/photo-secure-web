import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Portfolio, getPublicPortfolio } from '@/lib/portfolioApi';
import PortfolioNav from '@/components/portfolio/PortfolioNav';
import PortfolioHero from '@/components/portfolio/PortfolioHero';
import PortfolioStories from '@/components/portfolio/PortfolioStories';

const PublicPortfolio = () => {
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
          document.title = p.title || 'Портфолио фотографа';
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const openCategory = useCallback((catSlug: string) => {
    navigate(`/p/${slug}/${catSlug}`);
  }, [navigate, slug]);

  const scrollTo = useCallback((id: string) => {
    if (id === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  if (notFound || !portfolio) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Icon name="ImageOff" size={48} className="text-gray-600" />
        <h1 className="text-xl font-semibold">Портфолио не найдено</h1>
        <p className="text-gray-400 text-sm">Возможно, ссылка устарела или портфолио ещё не опубликовано.</p>
      </div>
    );
  }

  const accent = portfolio.accent_color || '#7c3aed';
  const photos = portfolio.photos || [];
  // Слайд-шоу обложки: только фото без категории
  const slideshowPhotos = photos.filter((p) => p.category_id === null);
  const logo = portfolio.logo_text || portfolio.title || 'PORTFOLIO';

  const contacts = [
    portfolio.vk && { icon: 'Share2', label: 'ВКонтакте', href: portfolio.vk },
    portfolio.whatsapp && { icon: 'MessageCircle', label: 'WhatsApp', href: `https://wa.me/${portfolio.whatsapp.replace(/\D/g, '')}` },
    portfolio.telegram && { icon: 'Send', label: 'Telegram', href: portfolio.telegram.startsWith('http') ? portfolio.telegram : `https://t.me/${portfolio.telegram.replace('@', '')}` },
    portfolio.instagram && { icon: 'Instagram', label: 'Instagram', href: portfolio.instagram },
    portfolio.phone && { icon: 'Phone', label: portfolio.phone, href: `tel:${portfolio.phone}` },
  ].filter(Boolean) as { icon: string; label: string; href: string }[];

  return (
    <div className="min-h-screen bg-black text-white" style={{ ['--accent' as string]: accent }}>
      <div id="top" />
      <PortfolioNav
        logo={logo}
        categories={portfolio.categories}
        position={portfolio.menu_position || 'top-right'}
        showReviews={portfolio.show_reviews && portfolio.reviews.length > 0}
        showAbout={portfolio.show_about}
        onOpenCategory={openCategory}
        onScrollTo={scrollTo}
      />

      <PortfolioHero
        photos={slideshowPhotos.length > 0 ? slideshowPhotos : photos}
        title={portfolio.title}
        subtitle={portfolio.subtitle}
        autoplay={portfolio.slideshow_enabled}
      />

      {portfolio.show_stories_block !== false && (
        <PortfolioStories
          categories={portfolio.categories}
          photos={photos}
          accent={accent}
          onOpenCategory={openCategory}
        />
      )}

      {/* Отзывы */}
      {portfolio.show_reviews && portfolio.reviews.length > 0 && (
        <section id="reviews" className="border-t border-white/10 py-16 sm:py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-light tracking-[0.2em] uppercase text-center mb-12">Отзывы</h2>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [column-fill:_balance]">
              {portfolio.reviews.map((r) => (
                <div key={r.id} className="mb-5 break-inside-avoid rounded-2xl bg-white/[0.04] border border-white/10 p-6 text-center">
                  <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center font-semibold text-lg mb-3" style={{ background: accent }}>
                    {r.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-medium text-lg">{r.author_name}</div>
                  <div className="text-amber-400 text-sm my-2">{'★'.repeat(r.rating)}<span className="text-white/20">{'★'.repeat(5 - r.rating)}</span></div>
                  <p className="text-white/70 text-sm leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Обо мне и контакты */}
      {portfolio.show_about && (portfolio.about || contacts.length > 0) && (
        <section id="contacts" className="border-t border-white/10 py-16 sm:py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-light tracking-[0.2em] uppercase mb-8">Контакты</h2>
            {portfolio.avatar_url && (
              <img src={portfolio.avatar_url} alt="" className="w-28 h-28 rounded-full object-cover mx-auto mb-6 border-2" style={{ borderColor: accent }} />
            )}
            {portfolio.about && <p className="text-white/70 leading-relaxed whitespace-pre-line mb-8">{portfolio.about}</p>}
            {contacts.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {contacts.map((c) => (
                  <a key={c.label} href={c.href} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 transition text-sm">
                    <Icon name={c.icon} size={16} style={{ color: accent }} /> {c.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="text-center text-white/30 text-xs py-8 border-t border-white/10 tracking-widest uppercase">
        {portfolio.title}
      </footer>

      {/* Плавающие соц-иконки */}
      {contacts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-30 flex flex-col gap-2">
          {contacts.slice(0, 2).map((c) => (
            <a key={c.icon} href={c.href} target="_blank" rel="noreferrer"
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur flex items-center justify-center transition"
              title={c.label}>
              <Icon name={c.icon} size={18} className="text-white" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default PublicPortfolio;