import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { Photo, PageDesignSettings } from './cover/types';
import { PreviewMode } from './PageDesignTab';

interface PhonePreviewProps {
  settings: PageDesignSettings;
  photos: Photo[];
  folderName: string;
  previewMode?: PreviewMode;
  onModeChange?: (mode: PreviewMode) => void;
}

export default function PhonePreview({ settings, photos, folderName, previewMode = 'mobile', onModeChange }: PhonePreviewProps) {
  const desktopCoverPhoto = photos.find(p => p.id === settings.coverPhotoId) || photos[0] || null;
  const mobileCoverPhoto = settings.mobileCoverPhotoId
    ? (photos.find(p => p.id === settings.mobileCoverPhotoId) || desktopCoverPhoto)
    : desktopCoverPhoto;
  const isDesktop = previewMode === 'desktop';
  const activeCoverPhoto = isDesktop ? desktopCoverPhoto : mobileCoverPhoto;
  const coverUrl = getThumbUrl(activeCoverPhoto?.thumbnail_url || activeCoverPhoto?.photo_url, 600);
  const focusX = isDesktop ? settings.coverFocusX : settings.mobileCoverFocusX;
  const focusY = isDesktop ? settings.coverFocusY : settings.mobileCoverFocusY;

  const getPreviewBg = (): React.CSSProperties => {
    if (settings.bgTheme === 'dark') return { background: '#1a1a2e' };
    if (settings.bgTheme === 'auto' && settings.bgColor) return { background: settings.bgColor };
    if (settings.bgTheme === 'custom' && settings.bgImageUrl) {
      return {
        backgroundImage: `url(${settings.bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (settings.bgTheme === 'custom' && settings.bgColor) return { background: settings.bgColor };
    return { background: '#f8f9fa' };
  };

  const isPreviewDark = (() => {
    const bg = settings.bgTheme;
    if (bg === 'dark') return true;
    if (bg === 'light') return false;
    if ((bg === 'auto' || bg === 'custom') && settings.bgColor) {
      const hex = settings.bgColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
    }
    return false;
  })();

  const getPreviewTextColor = () => {
    if (settings.textColor) return settings.textColor;
    return isPreviewDark ? '#ffffff' : '#1a1a2e';
  };

  const previewTextColor = getPreviewTextColor();
  const secondaryTextColor = previewTextColor === '#ffffff' || previewTextColor === '#f5f5f5' || previewTextColor === '#e0e0e0'
    ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';

  const scrollToPhotos = () => {
    const el = document.getElementById('preview-photo-grid');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const coverHeight = isDesktop ? 380 : 600;
  const titleFontScale = isDesktop ? 0.42 : 0.55;
  const minTitleFont = isDesktop ? 14 : 18;

  const pos = settings.coverTextPosition || 'bottom-center';
  const posClasses =
    pos === 'center' ? 'inset-0 flex flex-col items-center justify-center text-center px-4'
    : pos === 'top-center' ? 'inset-x-0 top-0 flex flex-col items-center text-center px-4 pt-10'
    : pos === 'bottom-left' ? 'inset-x-0 bottom-0 flex flex-col items-start text-left px-4'
    : pos === 'bottom-right' ? 'inset-x-0 bottom-0 flex flex-col items-end text-right px-4'
    : 'inset-x-0 bottom-0 flex flex-col items-center text-center px-4';
  const paddingBottom = pos.startsWith('bottom') ? (isDesktop ? 40 : 90) : undefined;

  const coverBlock = coverUrl ? (
    <div className="relative" style={{
      height: coverHeight,
      overflow: 'hidden',
      background: '#0a0a0a'
    }}>
      <img
        src={coverUrl}
        alt="preview cover"
        className={`w-full h-full ${isDesktop ? 'object-contain' : 'object-cover'}`}
        style={{
          objectPosition: `${focusX * 100}% ${focusY * 100}%`
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      <div className={`absolute ${posClasses}`} style={{ paddingBottom }}>
        <h2 className="font-bold leading-tight drop-shadow-lg" style={{
          color: settings.textColor || '#ffffff',
          fontSize: `${Math.max(minTitleFont, settings.coverFontSize * titleFontScale)}px`,
          marginBottom: 6
        }}>
          {settings.coverTitle || folderName}
        </h2>
        <button
          onClick={scrollToPhotos}
          className="inline-flex items-center gap-1 transition-colors"
          style={{
            color: settings.textColor ? `${settings.textColor}cc` : 'rgba(255,255,255,0.85)',
            fontSize: isDesktop ? 12 : 13
          }}
        >
          <span>Просмотр фото</span>
          <Icon name="ChevronDown" size={isDesktop ? 14 : 16} className="animate-bounce" />
        </button>
      </div>
    </div>
  ) : (
    <div className="h-32 flex items-center justify-center" style={{ background: 'rgba(128,128,128,0.2)' }}>
      <span className="text-xs" style={{ color: previewTextColor }}>{folderName}</span>
    </div>
  );

  const gap = Math.max(2, Math.round((settings.gridGap || 8) / 2));

  const photoGrid = (
    <>
      <div className="px-3 pt-3 pb-2">
        <p className="font-semibold leading-tight" style={{ color: previewTextColor, fontSize: isDesktop ? 14 : 13 }}>
          {folderName}
        </p>
        <p className="leading-tight mt-0.5" style={{ color: secondaryTextColor, fontSize: isDesktop ? 11 : 10 }}>
          {photos.length} фото
        </p>
      </div>

      <div id="preview-photo-grid" className="px-2 pb-3">
        <div
          className={isDesktop ? 'columns-4' : 'columns-2'}
          style={{ columnGap: `${gap}px` }}
        >
          {photos.slice(0, isDesktop ? 20 : 10).map(photo => (
            <div
              key={photo.id}
              className="rounded-md overflow-hidden break-inside-avoid"
              style={{
                marginBottom: `${gap}px`,
                background: 'rgba(128,128,128,0.2)'
              }}
            >
              <img
                src={getThumbUrl(photo.thumbnail_url || (/\.(cr2|cr3|nef|arw|dng|orf|rw2|raw|raf)$/i.test(photo.file_name || '') ? '' : photo.photo_url), 200)}
                alt=""
                className="w-full h-auto block"
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className={`flex-shrink-0 ${isDesktop ? 'lg:w-[560px]' : 'lg:w-[340px]'}`}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 text-center">
        Предпросмотр
      </h3>

      <div className="flex items-center justify-center gap-1 mb-3 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto" style={{ maxWidth: 200 }}>
        <button
          onClick={() => onModeChange?.('desktop')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
            isDesktop
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Icon name="Monitor" size={14} />
          Web
        </button>
        <button
          onClick={() => onModeChange?.('mobile')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
            !isDesktop
              ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Icon name="Smartphone" size={14} />
          Mobile
        </button>
      </div>

      {isDesktop ? (
        <div className="mx-auto" style={{ maxWidth: 540 }}>
          <div className="relative rounded-lg border-[3px] border-gray-800 dark:border-gray-600 bg-black overflow-hidden shadow-xl">
            <div className="bg-gray-200 dark:bg-gray-800 flex items-center gap-1 px-2 py-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <div className="flex-1 mx-2 h-3 bg-white dark:bg-gray-700 rounded" />
            </div>
            <div className="overflow-y-auto" style={{ height: 600, ...getPreviewBg() }}>
              {coverBlock}
              {photoGrid}
            </div>
          </div>
          <div className="mx-auto mt-1 bg-gray-300 dark:bg-gray-700 rounded-b-lg" style={{ width: '50%', height: 6 }} />
        </div>
      ) : (
        <div className="mx-auto" style={{ maxWidth: 320 }}>
          <div className="relative rounded-[24px] border-[3px] border-gray-800 dark:border-gray-600 bg-black overflow-hidden shadow-xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-20" />

            <div className="overflow-y-auto" style={{ height: 600, ...getPreviewBg() }}>
              {coverBlock}
              {photoGrid}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}