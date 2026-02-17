import Icon from '@/components/ui/icon';
import type { GalleryData } from '../GalleryGrid';

interface GalleryToolbarProps {
  gallery: GalleryData;
  isDarkBg: boolean;
  textColor: string;
  secondaryText: string;
  formatFileSize: (bytes: number) => string;
  clientName?: string;
  onOpenChat?: () => void;
  unreadMessagesCount: number;
  onOpenMyFavorites?: () => void;
  clientUploadEnabled: boolean;
  onOpenUpload?: () => void;
  downloadingAll: boolean;
  onDownloadAll: () => void;
  onLogout?: () => void;
  onClientLogin?: () => void;
}

export default function GalleryToolbar({
  gallery,
  isDarkBg,
  textColor,
  secondaryText,
  formatFileSize,
  clientName,
  onOpenChat,
  unreadMessagesCount,
  onOpenMyFavorites,
  clientUploadEnabled,
  onOpenUpload,
  downloadingAll,
  onDownloadAll,
  onLogout,
  onClientLogin
}: GalleryToolbarProps) {
  return (
    <div className="sticky top-0 z-50" style={{ 
      background: isDarkBg ? 'rgba(26,26,46,0.92)' : 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow: isDarkBg ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.08)'
    }}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex items-center gap-2 py-2 sm:py-2.5 overflow-x-auto">
          <p className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0" style={{ color: secondaryText }}>
            {gallery.photos.length} фото · {formatFileSize(gallery.total_size)}
          </p>
          <div className="flex-1" />
          {clientName ? (
            <>
              <button
                onClick={onOpenChat}
                className="relative w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-1.5 sm:px-2.5 sm:py-2 bg-blue-500 text-white rounded-full sm:rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
              >
                <Icon name="MessageCircle" size={14} className="flex-shrink-0" />
                <span className="hidden sm:inline">Написать</span>
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 shadow-lg">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                )}
              </button>
              <button
                onClick={onOpenMyFavorites}
                className="w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-1.5 sm:px-2.5 sm:py-2 bg-yellow-500 text-white rounded-full sm:rounded-lg hover:bg-yellow-600 active:bg-yellow-700 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
              >
                <Icon name="Star" size={14} className="flex-shrink-0" />
                <span className="hidden sm:inline">Избранное</span>
              </button>
              {clientUploadEnabled && onOpenUpload && (
                <button
                  onClick={onOpenUpload}
                  className="w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-1.5 sm:px-2.5 sm:py-2 bg-green-500 text-white rounded-full sm:rounded-lg hover:bg-green-600 active:bg-green-700 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                >
                  <Icon name="Upload" size={14} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Загрузить фото</span>
                </button>
              )}
              {!gallery.download_disabled && (
                <button
                  onClick={onDownloadAll}
                  disabled={downloadingAll}
                  className="w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-1.5 sm:px-2.5 sm:py-2 bg-blue-600 text-white rounded-full sm:rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                >
                  <Icon name={downloadingAll ? "Loader2" : "Download"} size={14} className={`flex-shrink-0 ${downloadingAll ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{downloadingAll ? 'Загрузка...' : 'Скачать всё'}</span>
                </button>
              )}
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg flex-shrink-0" style={{
                background: isDarkBg ? 'rgba(255,255,255,0.1)' : '#f3f4f6'
              }}>
                <Icon name="User" size={13} className="flex-shrink-0" style={{ color: secondaryText }} />
                <span className="text-xs font-medium truncate max-w-[80px] sm:max-w-[120px]" style={{ color: textColor }}>{clientName}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs touch-manipulation flex-shrink-0"
                style={{
                  background: isDarkBg ? 'rgba(239,68,68,0.15)' : '#fee2e2',
                  color: isDarkBg ? '#fca5a5' : '#b91c1c'
                }}
              >
                <Icon name="LogOut" size={13} className="flex-shrink-0" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClientLogin}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                style={{
                  background: isDarkBg ? 'rgba(59,130,246,0.2)' : '#dbeafe',
                  color: isDarkBg ? '#93c5fd' : '#1d4ed8'
                }}
              >
                <Icon name="User" size={14} className="flex-shrink-0" />
                Войти
              </button>
              {clientUploadEnabled && onOpenUpload && (
                <button
                  onClick={onOpenUpload}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 active:bg-green-700 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                >
                  <Icon name="Upload" size={14} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Загрузить фото</span>
                </button>
              )}
              {!gallery.download_disabled && (
                <button
                  onClick={onDownloadAll}
                  disabled={downloadingAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                >
                  <Icon name={downloadingAll ? "Loader2" : "Download"} size={14} className={`flex-shrink-0 ${downloadingAll ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{downloadingAll ? 'Загрузка...' : 'Скачать всё'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
