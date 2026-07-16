import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Portfolio, getPublicPortfolio } from '@/lib/portfolioApi';
import PortfolioNav from '@/components/portfolio/PortfolioNav';
import PortfolioHero from '@/components/portfolio/PortfolioHero';
import { maxContacts } from '@/utils/maxLink';

const PublicPortfolio = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [logoTone, setLogoTone] = useState<'light' | 'dark'>('dark');

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
    if (id === 'reviews') { navigate(`/p/${slug}/otzyvy`); return; }
    if (id === 'contacts') { navigate(`/p/${slug}/kontakty`); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
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
  const photos = portfolio.photos || [];
  // Слайд-шоу обложки: только фото без категории
  const slideshowPhotos = photos.filter((p) => p.category_id === null);
  const logo = portfolio.logo_text || portfolio.title || 'PORTFOLIO';

  const MAX_ICON = 'https://cdn.poehali.dev/projects/07a45ae1-582a-4829-83a6-3f379eb489ff/bucket/7f4f7cba-6d47-47ce-b655-35fb6674612d.png';
  const MAX_GRADIENT = 'linear-gradient(135deg, #2787F5 0%, #7B3FE4 100%)';

  const contacts = [
    portfolio.vk && { icon: 'vk', label: 'ВКонтакте', href: portfolio.vk },
    ...maxContacts(portfolio.whatsapp, MAX_ICON),
    ...maxContacts(portfolio.max, MAX_ICON),
    portfolio.telegram && { icon: 'Send', label: 'Telegram', href: portfolio.telegram.startsWith('http') ? portfolio.telegram : `https://t.me/${portfolio.telegram.replace('@', '')}` },
    portfolio.instagram && { icon: 'Instagram', label: 'Instagram', href: portfolio.instagram },
    portfolio.phone && { icon: 'Phone', label: portfolio.phone, href: `tel:${portfolio.phone}` },
  ].filter(Boolean) as { icon?: string; img?: string; label: string; href: string }[];

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ ['--accent' as string]: accent }}>
      <div id="top" />
      <PortfolioNav
        logo={logo}
        logoTone={logoTone}
        categories={portfolio.categories}
        position={portfolio.menu_position || 'top-right'}
        showReviews={portfolio.show_reviews && portfolio.reviews.length > 0}
        showAbout={portfolio.show_about}
        onOpenCategory={openCategory}
        onScrollTo={scrollTo}
      />

      <PortfolioHero
        photos={slideshowPhotos.length > 0 ? slideshowPhotos : photos}
        mobilePhotos={portfolio.slider_photos || []}
        title={portfolio.title}
        subtitle={portfolio.subtitle}
        autoplay={portfolio.slideshow_enabled}
        onCornerTone={setLogoTone}
      />

      {/* Плавающие соц-иконки — выезжают паровозиком */}
      {contacts.length > 0 && (
        <div
          className="fixed right-5 z-50 flex flex-col items-center gap-2"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
        >
          {contacts.map((c, i) => (
            <a key={c.label} href={c.href} target="_blank" rel="noreferrer"
              title={c.label}
              className={`w-11 h-11 rounded-full shadow-lg overflow-hidden flex items-center justify-center transition-all duration-300 ${
                fabOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'
              }`}
              style={{
                transitionDelay: `${fabOpen ? (contacts.length - 1 - i) * 60 : i * 40}ms`,
                background: c.img ? undefined : MAX_GRADIENT,
              }}>
              {c.img
                ? <img src={c.img} alt={c.label} className="w-full h-full object-cover" />
                : c.icon === 'vk'
                  ? <span className="text-white font-bold text-[13px] tracking-tight">VK</span>
                  : <Icon name={c.icon || 'Link'} size={18} className="text-white" />}
            </a>
          ))}
          <button
            onClick={() => setFabOpen((v) => !v)}
            aria-label={fabOpen ? 'Закрыть' : 'Контакты'}
            className="w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
            style={{ background: MAX_GRADIENT }}>
            <Icon name={fabOpen ? 'X' : 'MessageSquare'} size={22} className="text-white transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
};

export default PublicPortfolio;