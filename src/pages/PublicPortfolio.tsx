import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Portfolio, getPublicPortfolio } from '@/lib/portfolioApi';
import PortfolioGallery from '@/components/portfolio/PortfolioGallery';
import PortfolioSlideshow from '@/components/portfolio/PortfolioSlideshow';

const PublicPortfolio = () => {
  const { slug } = useParams<{ slug: string }>();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<number | null>(null);

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
  const filtered = activeCat === null ? photos : photos.filter((p) => p.category_id === activeCat);
  const cover = portfolio.cover_url || photos[0]?.photo_url || '';

  const contacts = [
    portfolio.phone && { icon: 'Phone', label: portfolio.phone, href: `tel:${portfolio.phone}` },
    portfolio.whatsapp && { icon: 'MessageCircle', label: 'WhatsApp', href: `https://wa.me/${portfolio.whatsapp.replace(/\D/g, '')}` },
    portfolio.telegram && { icon: 'Send', label: 'Telegram', href: portfolio.telegram.startsWith('http') ? portfolio.telegram : `https://t.me/${portfolio.telegram.replace('@', '')}` },
    portfolio.instagram && { icon: 'Instagram', label: 'Instagram', href: portfolio.instagram },
    portfolio.vk && { icon: 'Share2', label: 'ВКонтакте', href: portfolio.vk },
  ].filter(Boolean) as { icon: string; label: string; href: string }[];

  return (
    <div className="min-h-screen bg-black text-white" style={{ ['--accent' as string]: accent }}>
      {/* Обложка */}
      <div className="relative h-[70vh] min-h-[420px] overflow-hidden">
        {cover && (
          <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
        <div className="relative h-full flex flex-col items-center justify-end pb-14 px-6 text-center">
          {portfolio.avatar_url && (
            <img src={portfolio.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover border-2 mb-4" style={{ borderColor: accent }} />
          )}
          <h1 className="text-3xl sm:text-5xl font-bold drop-shadow-lg">{portfolio.title}</h1>
          {portfolio.subtitle && <p className="text-lg text-gray-200 mt-2 drop-shadow">{portfolio.subtitle}</p>}
          {portfolio.slideshow_enabled && photos.length > 0 && (
            <button
              onClick={() => setSlideshowOpen(true)}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition hover:opacity-90"
              style={{ background: accent }}
            >
              <Icon name="Play" size={18} /> Смотреть слайд-шоу
            </button>
          )}
        </div>
      </div>

      {/* Категории */}
      {portfolio.categories.length > 0 && (
        <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/10">
          <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto px-4 py-3">
            <button
              onClick={() => setActiveCat(null)}
              className={`shrink-0 text-sm px-4 py-1.5 rounded-full transition ${activeCat === null ? 'text-white' : 'bg-white/10 text-gray-300'}`}
              style={activeCat === null ? { background: accent } : undefined}
            >
              Все работы
            </button>
            {portfolio.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`shrink-0 text-sm px-4 py-1.5 rounded-full transition ${activeCat === c.id ? 'text-white' : 'bg-white/10 text-gray-300'}`}
                style={activeCat === c.id ? { background: accent } : undefined}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Галерея */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-8">
        <PortfolioGallery photos={filtered} accent={accent} />
      </div>

      {/* Отзывы */}
      {portfolio.show_reviews && portfolio.reviews.length > 0 && (
        <div className="border-t border-white/10 py-12 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Отзывы клиентов</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {portfolio.reviews.map((r) => (
                <div key={r.id} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold" style={{ background: accent }}>
                      {r.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{r.author_name}</div>
                      <div className="text-amber-400 text-sm">{'★'.repeat(r.rating)}<span className="text-gray-600">{'★'.repeat(5 - r.rating)}</span></div>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Обо мне и контакты */}
      {portfolio.show_about && (portfolio.about || contacts.length > 0) && (
        <div className="border-t border-white/10 py-12 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4">Обо мне</h2>
            {portfolio.about && <p className="text-gray-300 leading-relaxed whitespace-pre-line mb-8">{portfolio.about}</p>}
            {contacts.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {contacts.map((c) => (
                  <a
                    key={c.label}
                    href={c.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 transition text-sm"
                  >
                    <Icon name={c.icon} size={16} style={{ color: accent }} /> {c.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="text-center text-gray-500 text-xs py-6 border-t border-white/10">
        {portfolio.title}
      </footer>

      {slideshowOpen && (
        <PortfolioSlideshow photos={photos} onClose={() => setSlideshowOpen(false)} />
      )}
    </div>
  );
};

export default PublicPortfolio;
