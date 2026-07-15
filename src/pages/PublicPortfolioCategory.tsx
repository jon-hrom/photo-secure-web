import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { Portfolio, PortfolioCategory, getPublicPortfolio } from '@/lib/portfolioApi';
import { CircularGallery, GalleryItem } from '@/components/ui/circular-gallery';

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800" />
      </div>
    );
  }

  if (notFound || !portfolio || !cat) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Icon name="ImageOff" size={48} className="text-gray-300" />
        <h1 className="text-xl font-semibold">Категория не найдена</h1>
        <button onClick={() => navigate(`/p/${slug}`)} className="text-sm text-gray-500 hover:text-gray-900 underline">
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

  const galleryItems: GalleryItem[] = visibleShootings.map((s) => ({
    title: s.title,
    subtitle: `${countFor(s.id)} фото`,
    imageUrl: coverFor(s.id, s.cover_url),
    onClick: () => navigate(`/p/${slug}/${category}/${s.slug}`),
  }));

  const header = (
    <div className="sticky top-0 z-20 flex items-center justify-between px-5 sm:px-8 py-4 bg-white/90 backdrop-blur border-b border-gray-200">
      <button onClick={() => navigate(`/p/${slug}`)} className="inline-flex items-center gap-2 text-sm hover:text-gray-500 transition">
        <Icon name="ArrowLeft" size={18} /> В портфолио
      </button>
      <h1 className="text-lg sm:text-2xl font-light tracking-widest uppercase truncate">{cat.title}</h1>
      <div className="w-24 hidden sm:block" />
    </div>
  );

  if (galleryItems.length === 0) {
    return (
      <div className="min-h-screen bg-white text-gray-900" style={{ ['--accent' as string]: accent }}>
        {header}
        <p className="text-center text-gray-500 py-20">В этой категории пока нет съёмок</p>
      </div>
    );
  }

  return (
    <div className="bg-white text-gray-900" style={{ ['--accent' as string]: accent, height: '300vh' }}>
      <div className="w-full h-screen sticky top-0 flex flex-col overflow-hidden">
        {header}
        <div className="text-center mt-6 z-10">
          <p className="text-gray-500 tracking-wider">Листайте вниз, чтобы вращать галерею</p>
        </div>
        <div className="flex-1 w-full">
          <CircularGallery
            items={galleryItems}
            radius={galleryItems.length <= 3 ? 420 : 600}
          />
        </div>
      </div>
    </div>
  );
};

export default PublicPortfolioCategory;