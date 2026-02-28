import Icon from '@/components/ui/icon';

interface UploadStage {
  label: string;
  icon: string;
  progressRange: [number, number];
}

interface VideoUploadProgressProps {
  loading: boolean;
  uploadDone: boolean;
  progress: number;
  currentStage: UploadStage | null;
  onCancel: () => void;
  filesize: number;
  estimatedDuration: number;
  formatSize: (bytes: number) => string;
}

export default function VideoUploadProgress({
  loading,
  uploadDone,
  progress,
  currentStage,
  onCancel,
  filesize,
  estimatedDuration,
  formatSize
}: VideoUploadProgressProps) {
  if (!loading && !uploadDone) return null;

  return (
    <div className="space-y-2">
      <div className="relative w-full h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out ${
            uploadDone
              ? 'bg-green-500'
              : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
        {loading && !uploadDone && (
          <div
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse"
            style={{
              left: `${Math.max(0, progress - 15)}%`,
              width: '15%'
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {uploadDone ? (
            <>
              <Icon name="CheckCircle2" size={14} className="text-green-500 flex-shrink-0" />
              <span className="text-xs font-medium text-green-600 truncate">
                Готово!
              </span>
            </>
          ) : currentStage ? (
            <>
              <Icon
                name={currentStage.icon}
                size={14}
                className="text-blue-500 flex-shrink-0 animate-pulse"
              />
              <span className="text-xs text-muted-foreground truncate">
                {currentStage.label}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-xs font-mono tabular-nums ${
            uploadDone ? 'text-green-600' : 'text-muted-foreground'
          }`}>
            {Math.round(progress)}%
          </span>
          {loading && !uploadDone && (
            <button
              onClick={onCancel}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
            >
              Отменить
            </button>
          )}
        </div>
      </div>

      {loading && filesize > 0 && (
        <p className="text-[10px] text-muted-foreground/60">
          ~ {formatSize(filesize)} — обычно {estimatedDuration < 30 ? 'до 30 сек' :
            estimatedDuration < 90 ? '1-2 мин' : '2-3 мин'}
        </p>
      )}
    </div>
  );
}
