import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import type { Photo } from './types';

interface MyFavoritesGridProps {
  isDarkTheme: boolean;
  isLoading: boolean;
  error: string;
  displayPhotos: Photo[];
  selectionMode: 'cover' | 'vignette' | null;
  pendingSelection: number | null;
  coverPhotoId: number | null;
  vignettePhotoId: number | null;
  loadFavorites: () => void;
  setPendingSelection: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedPhoto: (photo: Photo) => void;
  handleRemoveFromFavorites: (photoId: number) => void;
}

export default function MyFavoritesGrid({
  isDarkTheme,
  isLoading,
  error,
  displayPhotos,
  selectionMode,
  pendingSelection,
  coverPhotoId,
  vignettePhotoId,
  loadFavorites,
  setPendingSelection,
  setSelectedPhoto,
  handleRemoveFromFavorites,
}: MyFavoritesGridProps) {
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8 sm:py-12 px-4">
          <Icon name="AlertCircle" size={40} className="text-red-500 mx-auto mb-3 sm:mb-4 sm:w-12 sm:h-12" />
          <p className={`text-sm sm:text-base ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
          <Button onClick={loadFavorites} className="mt-3 sm:mt-4 touch-manipulation">
            Попробовать снова
          </Button>
        </div>
      ) : displayPhotos.length === 0 ? (
        <div className="text-center py-8 sm:py-12 px-4">
          <Icon name="Star" size={48} className={`mx-auto mb-3 sm:mb-4 sm:w-16 sm:h-16 ${isDarkTheme ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-base sm:text-lg ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Вы ещё не добавили фото в избранное</p>
          <p className={`text-xs sm:text-sm mt-2 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
            Нажмите на звёздочку на любом фото, чтобы добавить его сюда
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {displayPhotos.map((photo) => {
            const isPending = selectionMode && pendingSelection === photo.id;
            const isCover = coverPhotoId === photo.id;
            const isVignette = vignettePhotoId === photo.id;
            return (
            <div
              key={photo.id}
              className={`relative group rounded-md sm:rounded-lg overflow-hidden cursor-pointer aspect-square touch-manipulation ${isDarkTheme ? 'bg-gray-800' : 'bg-gray-100'}`}
              style={isPending ? { outline: '3px solid #8b5cf6', outlineOffset: '-3px' } : undefined}
            >
              <div 
                className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-10 bg-black/60 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded max-w-[calc(100%-1rem)] truncate cursor-pointer hover:bg-black/70 active:bg-black/80 transition-colors touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(photo.file_name);
                  const btn = e.currentTarget;
                  const originalText = btn.textContent;
                  btn.textContent = 'Имя скопировано';
                  setTimeout(() => {
                    btn.textContent = originalText;
                  }, 2000);
                }}
                title="Нажмите, чтобы скопировать"
              >
                {photo.file_name}
              </div>
              <img
                src={photo.thumbnail_url || photo.photo_url}
                alt={photo.file_name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105 active:scale-95"
                onClick={() => {
                  if (selectionMode) {
                    setPendingSelection(prev => prev === photo.id ? null : photo.id);
                  } else {
                    setSelectedPhoto(photo);
                  }
                }}
              />
              {selectionMode && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/20"
                  onClick={() => setPendingSelection(prev => prev === photo.id ? null : photo.id)}
                >
                  {isPending && (
                    <div className="flex items-center justify-center rounded-full bg-purple-500 w-9 h-9">
                      <Icon name="Check" size={20} className="text-white" />
                    </div>
                  )}
                </div>
              )}
              {!selectionMode && (isCover || isVignette) && (
                <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center gap-1 pt-1.5 px-1.5 pointer-events-none">
                  {isCover && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wide shadow-lg ring-2 ring-white/70 animate-pulse">
                      <Icon name="Image" size={12} /> Обложка
                    </span>
                  )}
                  {isVignette && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wide shadow-lg ring-2 ring-white/70 animate-pulse">
                      <Icon name="Sparkles" size={12} /> Виньетка
                    </span>
                  )}
                </div>
              )}
              {!selectionMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFromFavorites(photo.id);
                }}
                className="absolute top-1.5 right-1.5 p-1.5 bg-red-500/90 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-600 active:bg-red-700 shadow touch-manipulation"
                title="Удалить из избранного"
              >
                <Icon name="Trash2" size={13} />
              </button>
              )}
              {!selectionMode && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    let s3_key = photo.s3_key || photo.photo_url.split('/bucket/')[1] || photo.photo_url.split('/').slice(-3).join('/');
                    s3_key = s3_key.split('?')[0];
                    
                    const isLargeFile = photo.file_name.toUpperCase().endsWith('.CR2') || 
                                       photo.file_name.toUpperCase().endsWith('.NEF') ||
                                       photo.file_name.toUpperCase().endsWith('.ARW') ||
                                       photo.file_size > 3 * 1024 * 1024;
                    
                    const response = await fetch(
                      `https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215?s3_key=${encodeURIComponent(s3_key)}${isLargeFile ? '&presigned=true' : ''}`
                    );
                    if (!response.ok) throw new Error('Ошибка скачивания');
                    
                    if (isLargeFile) {
                      const data = await response.json();
                      const a = document.createElement('a');
                      a.href = data.download_url;
                      a.download = photo.file_name;
                      a.target = '_blank';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    } else {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = photo.file_name;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    }
                  } catch (e) {
                    console.error('Download failed:', e);
                    alert('Ошибка при скачивании фото');
                  }
                }}
                className="absolute bottom-1.5 right-1.5 p-1.5 bg-blue-500/90 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-blue-600 active:bg-blue-700 shadow touch-manipulation"
                title="Скачать фото"
              >
                <Icon name="Download" size={13} />
              </button>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
