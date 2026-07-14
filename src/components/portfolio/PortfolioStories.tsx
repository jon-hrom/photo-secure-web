import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { PortfolioCategory, PortfolioPhoto } from '@/lib/portfolioApi';

interface Props {
  categories: PortfolioCategory[];
  photos: PortfolioPhoto[];
  accent: string;
  onOpenCategory: (id: number | null) => void;
}

const PortfolioStories = ({ categories, photos, accent, onOpenCategory }: Props) => {
  // Для каждой категории берём первое фото как обложку
  const coverFor = (catId: number | null) => {
    const p = photos.find((ph) => (catId === null ? true : ph.category_id === catId));
    return p ? (getThumbUrl(p.photo_url, 800) || p.grid_thumbnail_url || p.photo_url) : '';
  };

  const cards: { id: number | null; title: string; count: number }[] = [
    { id: null, title: 'Все работы', count: photos.length },
    ...categories.map((c) => ({
      id: c.id,
      title: c.title,
      count: photos.filter((p) => p.category_id === c.id).length,
    })),
  ];

  if (photos.length === 0) return null;

  return (
    <section id="stories" className="py-16 sm:py-24 px-4 sm:px-8 bg-black">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-center text-3xl sm:text-4xl font-light tracking-[0.2em] uppercase mb-3">Истории</h2>
        <p className="text-center text-white/50 mb-12 tracking-wider">Выберите категорию, чтобы посмотреть работы</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {cards.map((card) => (
            <button
              key={String(card.id)}
              onClick={() => onOpenCategory(card.id)}
              className="group relative h-72 sm:h-80 rounded-2xl overflow-hidden"
            >
              {coverFor(card.id) ? (
                <img
                  src={coverFor(card.id)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-white/5" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span className="text-2xl sm:text-3xl font-light tracking-widest uppercase drop-shadow-lg">{card.title}</span>
                <span className="mt-2 text-sm text-white/70">{card.count} фото</span>
                <span
                  className="mt-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition"
                  style={{ color: accent }}
                >
                  Смотреть <Icon name="ArrowRight" size={14} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PortfolioStories;
