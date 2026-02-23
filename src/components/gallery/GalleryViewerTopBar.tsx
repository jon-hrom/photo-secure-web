import Icon from '@/components/ui/icon';

interface GalleryViewerTopBarProps {
  currentIndex: number;
  totalCount: number;
  fileName: string;
  isFullscreen: boolean;
  zoom: number;
  downloadDisabled: boolean;
  onDownload?: () => void;
  onExitFullscreen: () => void;
  onResetZoom: () => void;
  onShowHelp: () => void;
  onClose: () => void;
  showUI: boolean;
}

export default function GalleryViewerTopBar({
  currentIndex,
  totalCount,
  fileName,
  isFullscreen,
  zoom,
  downloadDisabled,
  onDownload,
  onExitFullscreen,
  onResetZoom,
  onShowHelp,
  onClose,
  showUI,
}: GalleryViewerTopBarProps) {
  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 z-50 transition-opacity duration-300"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        opacity: showUI ? 1 : 0,
        pointerEvents: showUI ? 'auto' : 'none',
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
        <div className="text-white/80 text-xs bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-full flex-shrink-0">
          {currentIndex + 1} / {totalCount}
        </div>
        <div className="text-white/70 text-xs bg-black/30 backdrop-blur-sm px-2.5 py-1.5 rounded-full truncate hidden sm:block">
          {fileName}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isFullscreen && (
          <button
            onClick={onExitFullscreen}
            className="flex items-center justify-center rounded-full bg-white/10 active:bg-white/30 backdrop-blur-sm transition-all"
            style={{ width: 44, height: 44 }}
            title="Выйти из полного экрана"
          >
            <Icon name="Minimize2" size={20} className="text-white" />
          </button>
        )}
        {zoom > 0 && (
          <button
            onClick={onResetZoom}
            className="flex items-center justify-center rounded-full bg-white/10 active:bg-white/30 backdrop-blur-sm transition-all"
            style={{ width: 44, height: 44 }}
            title="Сбросить увеличение"
          >
            <Icon name="ZoomOut" size={20} className="text-white" />
          </button>
        )}
        {!downloadDisabled && onDownload && (
          <button
            onClick={onDownload}
            className="flex items-center justify-center rounded-full bg-white/10 active:bg-white/30 backdrop-blur-sm transition-all"
            style={{ width: 44, height: 44 }}
            title="Скачать фото"
          >
            <Icon name="Download" size={20} className="text-white" />
          </button>
        )}
        <button
          onClick={onShowHelp}
          className="flex items-center justify-center rounded-full bg-white/10 active:bg-white/30 backdrop-blur-sm transition-all"
          style={{ width: 44, height: 44 }}
          title="Справка"
        >
          <Icon name="HelpCircle" size={20} className="text-white" />
        </button>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-full bg-white/10 active:bg-white/30 backdrop-blur-sm transition-all"
          style={{ width: 44, height: 44 }}
        >
          <Icon name="X" size={22} className="text-white" />
        </button>
      </div>
    </div>
  );
}
