import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Portfolio, getPublicPortfolio } from '@/lib/portfolioApi';
import PortfolioNav from '@/components/portfolio/PortfolioNav';
import { maxContacts } from '@/utils/maxLink';

const MAX_ICON = 'https://cdn.poehali.dev/projects/07a45ae1-582a-4829-83a6-3f379eb489ff/bucket/7f4f7cba-6d47-47ce-b655-35fb6674612d.png';

const PublicPortfolioContacts = () => {
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
          document.title = `Контакты — ${p.title || 'Портфолио фотографа'}`;
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const openCategory = useCallback((catSlug: string) => {
    navigate(`/p/${slug}/${catSlug}`);
  }, [navigate, slug]);

  const onNav = useCallback((id: string) => {
    if (id === 'top') { navigate(`/p/${slug}`); return; }
    if (id === 'reviews') { navigate(`/p/${slug}/otzyvy`); return; }
    if (id === 'contacts') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
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

  const contacts = [
    portfolio.vk && { icon: 'Share2', label: 'ВКонтакте', href: portfolio.vk },
    ...maxContacts(portfolio.whatsapp, MAX_ICON),
    ...maxContacts(portfolio.max, MAX_ICON),
    portfolio.telegram && { icon: 'Send', label: 'Telegram', href: portfolio.telegram.startsWith('http') ? portfolio.telegram : `https://t.me/${portfolio.telegram.replace('@', '')}` },
    portfolio.instagram && { icon: 'Instagram', label: 'Instagram', href: portfolio.instagram },
    portfolio.phone && { icon: 'Phone', label: portfolio.phone, href: `tel:${portfolio.phone}` },
  ].filter(Boolean) as { icon?: string; img?: string; label: string; href: string }[];

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ ['--accent' as string]: accent }}>
      <div className="relative bg-black text-white">
        <PortfolioNav
          logo={logo}
          categories={portfolio.categories}
          position={portfolio.menu_position || 'top-right'}
          showReviews={portfolio.show_reviews && portfolio.reviews.length > 0}
          showAbout={portfolio.show_about}
          onOpenCategory={openCategory}
          onScrollTo={onNav}
        />
        <div className="h-[38vh] min-h-[260px] flex flex-col items-center justify-center text-center px-6">
          <span className="text-xs sm:text-sm tracking-[0.3em] uppercase text-white/50 mb-3">{portfolio.title}</span>
          <h1 className="text-4xl sm:text-6xl font-light tracking-[0.15em] uppercase">Контакты</h1>
        </div>
      </div>

      <section className="py-16 sm:py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {portfolio.avatar_url && (
            <img src={portfolio.avatar_url} alt="" className="w-28 h-28 rounded-full object-cover mx-auto mb-6 border-2" style={{ borderColor: accent }} />
          )}
          {portfolio.about && <p className="text-gray-600 leading-relaxed whitespace-pre-line mb-8">{portfolio.about}</p>}
          {contacts.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-3">
              {contacts.map((c) => (
                <a key={c.label} href={c.href} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 transition text-sm">
                  {c.img
                    ? <img src={c.img} alt="" className="w-5 h-5 rounded object-cover" />
                    : <Icon name={c.icon || 'Link'} size={16} style={{ color: accent }} />} {c.label}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">Контактная информация не указана.</p>
          )}
        </div>
      </section>

      <footer className="text-center text-gray-400 text-xs py-8 border-t border-gray-200 tracking-widest uppercase">
        {portfolio.title}
      </footer>
    </div>
  );
};

export default PublicPortfolioContacts;