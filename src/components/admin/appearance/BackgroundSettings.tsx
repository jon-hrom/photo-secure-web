import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface BackgroundSettingsProps {
  backgroundOpacity: number;
  onOpacityChange: (value: number[]) => void;
  cardBackgroundImage: string | null;
  onCardBackgroundUpload: (files: FileList | null) => void;
  onCardBackgroundRemove: () => void;
}

const BackgroundSettings = ({ 
  backgroundOpacity, 
  onOpacityChange, 
  cardBackgroundImage, 
  onCardBackgroundUpload,
  onCardBackgroundRemove 
}: BackgroundSettingsProps) => {
  return (
    <div className="space-y-6">
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

      <div className="space-y-3">
        <Label className="text-sm font-medium">Фон карточки входа</Label>
        <div className="space-y-3">
          {cardBackgroundImage && (
            <div className="relative aspect-video rounded-lg overflow-hidden border">
              <img 
                src={cardBackgroundImage} 
                alt="Фон карточки входа" 
                className="w-full h-full object-cover"
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2"
                onClick={onCardBackgroundRemove}
              >
                <Icon name="Trash2" size={16} />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => onCardBackgroundUpload((e.target as HTMLInputElement).files);
                input.click();
              }}
            >
              <Icon name="Upload" size={16} className="mr-2" />
              {cardBackgroundImage ? 'Изменить фон' : 'Загрузить фон'}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Изображение будет отображаться на заднем фоне карточки входа
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackgroundSettings;