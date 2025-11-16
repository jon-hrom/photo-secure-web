import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface BackgroundSettingsProps {
  backgroundOpacity: number;
  onOpacityChange: (value: number[]) => void;
}

const BackgroundSettings = ({ backgroundOpacity, onOpacityChange }: BackgroundSettingsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Затемнение фона</Label>
          <span className="text-sm text-muted-foreground">{backgroundOpacity}%</span>
        </div>
        <Slider
          value={[backgroundOpacity]}
          onValueChange={onOpacityChange}
          min={0}
          max={80}
          step={5}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Прозрачность затемнения на странице входа для лучшей читаемости
        </p>
      </div>
    </div>
  );
};

export default BackgroundSettings;
