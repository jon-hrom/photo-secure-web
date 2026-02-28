import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface VideoUrlInputProps {
  url: string;
  onUrlChange: (value: string) => void;
  onExtract: () => void;
  extracting: boolean;
  disabled: boolean;
  showSources: boolean;
}

const SUPPORTED_SOURCES = [
  'YouTube', 'VK Видео', 'RuTube', 'Одноклассники',
  'Дзен', 'Telegram', 'Instagram', 'TikTok',
  'Прямые ссылки (.mp4, .mov)',
  'Файлообменники', 'M3U8'
];

export default function VideoUrlInput({
  url,
  onUrlChange,
  onExtract,
  extracting,
  disabled,
  showSources
}: VideoUrlInputProps) {
  return (
    <>
      <div className="flex gap-2">
        <Input
          placeholder="https://youtube.com/watch?v=... или любая другая ссылка"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={disabled}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !disabled) onExtract();
          }}
        />
        <Button
          onClick={onExtract}
          disabled={disabled || !url.trim()}
          size="default"
          variant="outline"
          className="shrink-0"
        >
          {extracting ? (
            <Icon name="Loader2" size={16} className="animate-spin" />
          ) : (
            <Icon name="Search" size={16} />
          )}
        </Button>
      </div>

      {showSources && (
        <div className="border rounded-lg p-3 bg-muted/20">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Поддерживаемые источники:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_SOURCES.map((source) => (
              <span
                key={source}
                className="px-2 py-0.5 bg-background border rounded text-[10px] sm:text-xs text-muted-foreground"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
