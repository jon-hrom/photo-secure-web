import Icon from '@/components/ui/icon';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface PageDesignSettings {
  coverPhotoId: number | null;
  coverOrientation: 'horizontal' | 'vertical';
  coverFocusX: number;
  coverFocusY: number;
  gridGap: number;
  bgTheme: 'light' | 'dark' | 'auto' | 'custom';
  bgColor: string | null;
  bgImageUrl: string | null;
  bgImageData: string | null;
  bgImageExt: string;
  textColor: string | null;
  coverTextPosition: 'bottom-center' | 'center' | 'bottom-left' | 'bottom-right' | 'top-center';
  coverTitle: string | null;
  coverFontSize: number;
  mobileCoverPhotoId: number | null;
  mobileCoverFocusX: number;
  mobileCoverFocusY: number;
}

interface PhonePreviewProps {
  settings: PageDesignSettings;
  photos: Photo[];
  folderName: string;
}

export default function PhonePreview({ settings, photos, folderName }: PhonePreviewProps) {
  const coverPhoto = photos.find(p => p.id === settings.coverPhotoId) || photos[0] || null;
  const coverUrl = coverPhoto?.thumbnail_url || coverPhoto?.photo_url;
  const isVertical = settings.coverOrientation === 'vertical';

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

  return (
    <div className="lg:w-[280px] flex-shrink-0">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 text-center">
        Предпросмотр
      </h3>
      <div className="mx-auto" style={{ maxWidth: 260 }}>
        <div className="relative rounded-[24px] border-[3px] border-gray-800 dark:border-gray-600 bg-black overflow-hidden shadow-xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-20" />
          
          <div className="overflow-y-auto" style={{ height: 480, ...getPreviewBg() }}>
            {coverUrl ? (
              <div className="relative" style={{ 
                height: isVertical ? 380 : 180,
                overflow: 'hidden'
              }}>
                <img
                  src={coverUrl}
                  alt="preview cover"
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: `${settings.coverFocusX * 100}% ${settings.coverFocusY * 100}%`
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className={`absolute inset-0 flex flex-col p-3 ${
                  settings.coverTextPosition === 'center' ? 'items-center justify-center text-center' :
                  settings.coverTextPosition === 'top-center' ? 'items-center justify-start text-center pt-6' :
                  settings.coverTextPosition === 'bottom-left' ? 'items-start justify-end' :
                  settings.coverTextPosition === 'bottom-right' ? 'items-end justify-end text-right' :
                  'items-center justify-end text-center'
                }`}>
                  <h2 className="font-bold leading-tight" style={{
                    color: settings.textColor || '#ffffff',
                    fontSize: `${Math.max(8, settings.coverFontSize * 0.3)}px`
                  }}>
                    {settings.coverTitle || folderName}
                  </h2>
                  <button
                    onClick={scrollToPhotos}
                    className="flex items-center gap-1 mt-1 text-[9px] transition-colors"
                    style={{ color: settings.textColor ? `${settings.textColor}cc` : 'rgba(255,255,255,0.8)' }}
                  >
                    Просмотр фото
                    <Icon name="ChevronDown" size={10} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center" style={{ background: 'rgba(128,128,128,0.2)' }}>
                <span className="text-xs" style={{ color: previewTextColor }}>{folderName}</span>
              </div>
            )}

            <div className="p-2">
              <div className="flex items-center justify-between mb-2 px-1">
                <div>
                  <p className="text-[9px] font-semibold" style={{ color: previewTextColor }}>{folderName}</p>
                  <p className="text-[8px]" style={{ color: secondaryTextColor }}>{photos.length} фото</p>
                </div>
              </div>
            </div>

            <div id="preview-photo-grid" className="px-2 pb-2">
              <div 
                className="columns-2"
                style={{ gap: `${Math.max(1, settings.gridGap / 3)}px` }}
              >
                {photos.slice(0, 8).map(photo => (
                  <div
                    key={photo.id}
                    className="rounded-sm overflow-hidden break-inside-avoid"
                    style={{ 
                      marginBottom: `${Math.max(1, settings.gridGap / 3)}px`,
                      background: 'rgba(128,128,128,0.2)'
                    }}
                  >
                    <img
                      src={photo.thumbnail_url || photo.photo_url}
                      alt=""
                      className="w-full h-auto"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}