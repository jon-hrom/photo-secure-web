import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { PortfolioCategory, PortfolioPhoto } from '@/lib/portfolioApi';

interface Props {
  categories: PortfolioCategory[];
  photos: PortfolioPhoto[];
  accent: string;
  onOpenCategory: (categorySlug: string) => void;
}

const PortfolioStories = ({ categories, photos, accent, onOpenCategory }: Props) => {
  // Обложка категории: вручную назначенная или первое фото категории
  const coverFor = (cat: PortfolioCategory) => {
    if (cat.cover_url) return getThumbUrl(cat.cover_url, 900) || cat.cover_url;
    const p = photos.find((ph) => ph.category_id === cat.id);
    return p ? (getThumbUrl(p.photo_url, 900) || p.grid_thumbnail_url || p.photo_url) : '';
  };

  const countFor = (catId: number) => photos.filter((p) => p.category_id === catId).length;

  // Показываем только категории, в которых есть фото
  const visibleCats = categories.filter((c) => countFor(c.id) > 0);

  if (visibleCats.length === 0) return null;

  return (
    <section id="stories" className="py-16 sm:py-24 px-4 sm:px-8 bg-white text-gray-900">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-center text-3xl sm:text-4xl font-light tracking-[0.2em] uppercase mb-3">Истории</h2>
        <p className="text-center text-gray-500 mb-12 tracking-wider">Выберите категорию съёмок</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {visibleCats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onOpenCategory(cat.slug)}
              className="group relative h-64 sm:h-80 rounded-2xl overflow-hidden"
            >
              {coverFor(cat) ? (
                <img
                  src={coverFor(cat)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-white/5" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span className="text-2xl sm:text-4xl font-light tracking-widest uppercase drop-shadow-lg">{cat.title}</span>
                <span className="mt-2 text-sm text-white/70">{countFor(cat.id)} фото</span>
                <span
                  className="mt-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition"
                  style={{ color: accent }}
                >
                  Смотреть съёмку <Icon name="ArrowRight" size={14} />
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