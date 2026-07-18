import { motion } from 'framer-motion';
import Icon from '@/components/ui/icon';
import { PortfolioReview } from '@/lib/portfolioApi';

interface Props {
  review: PortfolioReview;
  accent: string;
  onPhotoClick?: (url: string) => void;
}

const ReviewCard = ({ review, accent, onPhotoClick }: Props) => {
  const photos = (review.photos || []).filter(Boolean);
  const initial = (review.author_name || '?').charAt(0).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }}
      className="mb-5 break-inside-avoid rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-white shrink-0"
            style={{ background: accent }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[15px] truncate">{review.author_name}</div>
            {review.shooting_style && (
              <div className="text-xs text-gray-400 truncate">{review.shooting_style}</div>
            )}
          </div>
          <Icon name="Quote" size={22} className="ml-auto text-gray-200 shrink-0" />
        </div>

        <div className="flex items-center gap-0.5 mb-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <Icon
              key={n}
              name="Star"
              size={16}
              className={n <= review.rating ? 'text-amber-400' : 'text-gray-200'}
              fill={n <= review.rating ? '#fbbf24' : 'none'}
            />
          ))}
        </div>

        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{review.text}</p>
      </div>

      {photos.length > 0 && (
        <div className={`grid gap-1 px-1 pb-1 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
          {photos.slice(0, 6).map((url, i) => (
            <button
              key={i}
              onClick={() => onPhotoClick?.(url)}
              className={`relative overflow-hidden rounded-lg group ${photos.length === 1 ? 'aspect-[4/3]' : 'aspect-square'}`}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ReviewCard;
