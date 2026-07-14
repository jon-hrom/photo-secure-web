import { useEffect } from 'react';
import Icon from '@/components/ui/icon';
import PortfolioGallery from './PortfolioGallery';
import { PortfolioPhoto } from '@/lib/portfolioApi';

interface Props {
  title: string;
  photos: PortfolioPhoto[];
  accent: string;
  onClose: () => void;
}

const PortfolioCategoryView = ({ title, photos, accent, onClose }: Props) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-[55] bg-black overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 sm:px-8 py-4 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition">
            <Icon name="ArrowLeft" size={22} className="text-white" />
          </button>
          <h2 className="text-lg sm:text-2xl font-light tracking-widest uppercase">{title}</h2>
          <span className="text-sm text-white/50">· {photos.length} фото</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition">
          <Icon name="X" size={22} className="text-white" />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8">
        <PortfolioGallery photos={photos} accent={accent} />
      </div>
    </div>
  );
};

export default PortfolioCategoryView;
