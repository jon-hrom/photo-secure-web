import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';

interface Props {
  original: string;
  variants: string[];
  loading: boolean;
  onApply: (variant: string) => void;
  onRegenerate: () => void;
  onClose: () => void;
}

const VariantsPanel = ({ original, variants, loading, onApply, onRegenerate, onClose }: Props) => {
  return (
    <div className="p-3 sm:p-4 rounded-xl border bg-card space-y-3 max-h-[50vh] flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-muted-foreground mb-1">
            Оригинал предложения
          </div>
          <p className="text-sm italic leading-relaxed">{original}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <Icon name="X" size={16} />
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">
          Варианты от человека ({variants.length})
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={loading}
          className="h-7 text-xs"
        >
          <Icon
            name={loading ? 'Loader2' : 'RefreshCw'}
            size={12}
            className={`mr-1.5 ${loading ? 'animate-spin' : ''}`}
          />
          Ещё
        </Button>
      </div>

      <ScrollArea className="flex-1 pr-3">
        <div className="space-y-2">
          {loading && variants.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Icon name="Loader2" size={16} className="animate-spin" />
              Подбираю варианты…
            </div>
          )}
          {variants.map((v, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs text-muted-foreground mt-0.5 flex-shrink-0">
                  #{i + 1}
                </span>
                <p className="text-sm flex-1 leading-relaxed">{v}</p>
              </div>
              <div className="mt-2 flex gap-1.5 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(v)}
                  className="h-7 text-xs"
                >
                  <Icon name="Copy" size={12} className="mr-1" />
                  Копировать
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onApply(v)}
                  className="h-7 text-xs"
                >
                  <Icon name="Check" size={12} className="mr-1" />
                  Применить
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default VariantsPanel;
