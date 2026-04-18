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

  // Группируем предложения по абзацам
  const paragraphs: SentenceInfo[][] = [];
  sentences.forEach((s) => {
    const pIdx = s.paragraph || 0;
    if (!paragraphs[pIdx]) paragraphs[pIdx] = [];
    paragraphs[pIdx].push(s);
  });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3 text-[15px] leading-relaxed">
        {paragraphs.map((para, pIdx) => (
          <div key={pIdx} className="space-y-1.5">
            {para.map((s) => {
              const colorCls = getSentenceScoreColor(s.ai_score);
              const isSelected = selectedIndex === s.index;
              const markers = s.markers || [];
              const hasMarkers = markers.length > 0;
              const showBadge = s.ai_score >= 20;

              return (
                <Tooltip key={s.index}>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => onSelect(isSelected ? null : s.index)}
                      className={`group relative rounded-md pl-3 pr-2 py-1.5 cursor-pointer transition-all ${colorCls} ${
                        isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                      }`}
                    >
                      <span className="block pr-12">{s.text}</span>
                      {showBadge && (
                        <span
                          className={`absolute top-1.5 right-1.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            s.ai_score >= 80
                              ? 'bg-red-600 text-white'
                              : s.ai_score >= 60
                                ? 'bg-orange-600 text-white'
                                : s.ai_score >= 40
                                  ? 'bg-yellow-600 text-white'
                                  : 'bg-lime-600 text-white'
                          }`}
                        >
                          {s.ai_score.toFixed(0)}%
                        </span>
                      )}
                    </div>
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
        ))}
      </div>
    </TooltipProvider>
  );
};

export default HighlightedText;