import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface MyFavoritesSelectionBarProps {
  isDarkTheme: boolean;
  selectionMode: 'cover' | 'vignette' | null;
  pendingSelection: number | null;
  savingMarker: boolean;
  coverPhotoId: number | null;
  vignettePhotoId: number | null;
  coverSelectEnabled: boolean;
  vignetteSelectEnabled: boolean;
  startSelection: (type: 'cover' | 'vignette') => void;
  cancelSelection: () => void;
  confirmSelection: () => void;
}

export default function MyFavoritesSelectionBar({
  isDarkTheme,
  selectionMode,
  pendingSelection,
  savingMarker,
  coverPhotoId,
  vignettePhotoId,
  coverSelectEnabled,
  vignetteSelectEnabled,
  startSelection,
  cancelSelection,
  confirmSelection,
}: MyFavoritesSelectionBarProps) {
  return selectionMode ? (
    <div className={`flex items-center gap-2 px-3 sm:px-4 md:px-6 py-2.5 border-b ${isDarkTheme ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
          {selectionMode === 'cover' ? 'Выберите фото для обложки' : 'Выберите фото для виньетки'}
        </p>
        <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
          {pendingSelection ? 'Фото выбрано' : 'Нажмите на фото'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={cancelSelection} className="flex-shrink-0">Отмена</Button>
      <Button size="sm" onClick={confirmSelection} disabled={savingMarker} className="gap-1.5 flex-shrink-0">
        <Icon name={savingMarker ? 'Loader2' : 'Check'} size={14} className={savingMarker ? 'animate-spin' : ''} />
        Подтвердить
      </Button>
    </div>
  ) : (
    <div className={`flex items-center gap-2 px-3 sm:px-4 md:px-6 py-3 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-100'}`}>
      {coverSelectEnabled && (
        <button
          onClick={() => startSelection('cover')}
          className={`flex items-center justify-center gap-1.5 px-3 h-9 rounded-full text-xs font-medium flex-1 transition-colors ${
            coverPhotoId ? 'bg-purple-500 text-white' : (isDarkTheme ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700')
          }`}
        >
          <Icon name="Image" size={15} />
          Обложка{coverPhotoId ? ' ✓' : ''}
        </button>
      )}
      {vignetteSelectEnabled && (
        <button
          onClick={() => startSelection('vignette')}
          className={`flex items-center justify-center gap-1.5 px-3 h-9 rounded-full text-xs font-medium flex-1 transition-colors ${
            vignettePhotoId ? 'bg-purple-500 text-white' : (isDarkTheme ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700')
          }`}
        >
          <Icon name="Sparkles" size={15} />
          Виньетка{vignettePhotoId ? ' ✓' : ''}
        </button>
      )}
    </div>
  );
}
