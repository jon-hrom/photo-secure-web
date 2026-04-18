import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Icon from '@/components/ui/icon';
import type { SentenceInfo } from './types';
import { MARKER_LABELS } from './types';
import { getSentenceScoreColor } from './useHumanizerApi';

interface Props {
  sentences: SentenceInfo[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

const HighlightedText = ({ sentences, selectedIndex, onSelect }: Props) => {
  if (sentences.length === 0) {
    return <p className="text-muted-foreground text-sm italic">Нет текста для подсветки.</p>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="prose prose-sm max-w-none dark:prose-invert text-foreground leading-relaxed">
        {sentences.map((s) => {
          const colorCls = getSentenceScoreColor(s.ai_score);
          const isSelected = selectedIndex === s.index;
          const markers = s.markers || [];
          const hasMarkers = markers.length > 0;

          return (
            <Tooltip key={s.index}>
              <TooltipTrigger asChild>
                <span
                  onClick={() => onSelect(isSelected ? null : s.index)}
                  className={`inline rounded px-0.5 py-0.5 cursor-pointer transition-all mr-0.5 ${colorCls} ${
                    isSelected ? 'ring-2 ring-primary ring-offset-1' : ''
                  }`}
                >
                  {s.text}{' '}
                </span>
              </TooltipTrigger>
              {(s.ai_score > 0 || hasMarkers) && (
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon name="Bot" size={12} />
                      <span className="font-semibold">AI-score: {s.ai_score.toFixed(0)}%</span>
                    </div>
                    {hasMarkers && (
                      <div className="flex flex-wrap gap-1">
                        {markers.map((m) => (
                          <Badge key={m} variant="secondary" className="text-[10px] font-normal">
                            {MARKER_LABELS[m] || m}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      Нажмите, чтобы получить варианты переписывания
                    </div>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

export default HighlightedText;
