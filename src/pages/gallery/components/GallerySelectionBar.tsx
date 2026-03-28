import Icon from '@/components/ui/icon';

interface GallerySelectionBarProps {
  isDarkBg: boolean;
  textColor: string;
  selectedCount: number;
  downloadingSelected: boolean;
  selectedProgress: number;
  onSelectAll: () => void;
  onDownloadSelected: () => void;
}

export default function GallerySelectionBar({
  isDarkBg,
  textColor,
  selectedCount,
  downloadingSelected,
  selectedProgress,
  onSelectAll,
  onDownloadSelected,
}: GallerySelectionBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-2 px-4 py-3"
      style={{
        background: isDarkBg ? 'rgba(15,15,30,0.97)' : 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 -2px 16px rgba(0,0,0,0.15)',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))'
      }}
    >
      {downloadingSelected && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${selectedProgress}%` }}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium flex-1" style={{ color: textColor }}>
          {selectedCount > 0 ? `Выбрано: ${selectedCount}` : 'Выберите фото'}
        </span>
        <button
          onClick={onSelectAll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : '#f3f4f6', color: textColor }}
        >
          <Icon name="CheckSquare" size={15} />
          Выбрать все
        </button>
        <button
          onClick={onDownloadSelected}
          disabled={selectedCount === 0 || downloadingSelected}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white disabled:opacity-40 transition-colors hover:bg-indigo-700"
        >
          {downloadingSelected
            ? <><Icon name="Loader2" size={15} className="animate-spin" />{selectedProgress}%</>
            : <><Icon name="Download" size={15} />Скачать</>
          }
        </button>
      </div>
    </div>
  );
}
