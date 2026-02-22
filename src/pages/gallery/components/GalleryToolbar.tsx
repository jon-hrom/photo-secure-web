import Icon from '@/components/ui/icon';
import type { GalleryData } from '../GalleryGrid';

interface ClientFolder {
  id: number;
  folder_name: string;
  client_name: string | null;
  photo_count: number;
}

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
  clientFolders?: ClientFolder[];
  showClientFolders?: boolean;
  onOpenClientFolder?: (folder: ClientFolder) => void;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
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
  onClientLogin,
  clientFolders = [],
  showClientFolders = false,
  onOpenClientFolder,
  selectionMode = false,
  onToggleSelectionMode
}: GalleryToolbarProps) {
  const hasFolders = showClientFolders && clientFolders.length > 0;

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
                <>
                  <button
                    onClick={onToggleSelectionMode}
                    className={`w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-1.5 sm:px-2.5 sm:py-2 rounded-full sm:rounded-lg transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0 ${selectionMode ? 'bg-indigo-600 text-white' : (isDarkBg ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-700')}`}
                  >
                    <Icon name="CheckSquare" size={14} className="flex-shrink-0" />
                    <span className="hidden sm:inline">{selectionMode ? 'Отмена' : 'Выбрать'}</span>
                  </button>
                  <button
                    onClick={onDownloadAll}
                    disabled={downloadingAll}
                    className="w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-1.5 sm:px-2.5 sm:py-2 bg-blue-600 text-white rounded-full sm:rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                  >
                    <Icon name={downloadingAll ? "Loader2" : "Download"} size={14} className={`flex-shrink-0 ${downloadingAll ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{downloadingAll ? 'Загрузка...' : 'Скачать всё'}</span>
                  </button>
                </>
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
              {!gallery.download_disabled && (
                <>
                  <button
                    onClick={onToggleSelectionMode}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0 ${selectionMode ? 'bg-indigo-600 text-white' : (isDarkBg ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-700')}`}
                  >
                    <Icon name="CheckSquare" size={14} className="flex-shrink-0" />
                    <span>{selectionMode ? 'Отмена' : 'Выбрать'}</span>
                  </button>
                  <button
                    onClick={onDownloadAll}
                    disabled={downloadingAll}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                  >
                    <Icon name={downloadingAll ? "Loader2" : "Download"} size={14} className={`flex-shrink-0 ${downloadingAll ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{downloadingAll ? 'Загрузка...' : 'Скачать всё'}</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {hasFolders && (
          <div className="flex items-center gap-2 pb-2 overflow-x-auto scrollbar-none">
            <span className="text-xs flex-shrink-0" style={{ color: secondaryText }}>
              <Icon name="Users" size={12} className="inline mr-1" />
              Загружено:
            </span>
            {clientFolders.map(folder => (
              <button
                key={folder.id}
                onClick={() => onOpenClientFolder?.(folder)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95"
                style={{
                  background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  color: isDarkBg ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                  border: isDarkBg ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)'
                }}
              >
                <Icon name="Folder" size={12} />
                <span>{folder.folder_name}</span>
                {folder.photo_count > 0 && (
                  <span className="opacity-60">{folder.photo_count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}