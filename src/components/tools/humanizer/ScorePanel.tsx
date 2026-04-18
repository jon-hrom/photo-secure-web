import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { MARKER_LABELS } from './types';
import { getOverallColor } from './useHumanizerApi';

interface Props {
  scoreBefore: number | null;
  scoreAfter: number | null;
  markers: Record<string, number>;
}

const ScorePanel = ({ scoreBefore, scoreAfter, markers }: Props) => {
  const showBoth = scoreAfter !== null && scoreBefore !== null;
  const currentScore = scoreAfter ?? scoreBefore ?? 0;
  const delta = showBoth ? (scoreBefore! - scoreAfter!) : 0;

  return (
    <div className="space-y-3 p-4 rounded-xl border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Bot" size={16} className="text-muted-foreground" />
          <span className="font-semibold text-sm">AI-детекция</span>
        </div>
        {showBoth && delta > 0 && (
          <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/30">
            <Icon name="TrendingDown" size={12} className="mr-1" />
            −{delta.toFixed(1)}%
          </Badge>
        )}
      </div>

      {showBoth ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Было</div>
            <div className={`text-2xl font-bold ${getOverallColor(scoreBefore!)}`}>
              {scoreBefore!.toFixed(0)}%
            </div>
            <Progress value={scoreBefore!} className="h-1 mt-1" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Стало</div>
            <div className={`text-2xl font-bold ${getOverallColor(scoreAfter!)}`}>
              {scoreAfter!.toFixed(0)}%
            </div>
            <Progress value={scoreAfter!} className="h-1 mt-1" />
          </div>
        </div>
      ) : (
        <div>
          <div className={`text-3xl font-bold ${getOverallColor(currentScore)}`}>
            {currentScore.toFixed(0)}%
          </div>
          <Progress value={currentScore} className="h-2 mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {currentScore < 15 ? 'Текст похож на человеческий' :
              currentScore < 35 ? 'Есть признаки AI' :
                currentScore < 60 ? 'Много AI-маркеров' :
                  'Текст выглядит как сгенерированный'}
          </p>
        </div>
      )}

      {Object.keys(markers).length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1.5 text-muted-foreground">
            Найденные маркеры:
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(markers).map(([m, count]) => (
              <Badge key={m} variant="outline" className="text-[10px]">
                {MARKER_LABELS[m] || m} · {count}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScorePanel;
