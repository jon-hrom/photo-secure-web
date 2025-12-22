import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { BackgroundImage } from './BackgroundGallery';

interface BackgroundSettingsProps {
  backgroundOpacity: number;
  onOpacityChange: (value: number[]) => void;
  cardBackgroundImages: BackgroundImage[];
  cardTransitionTime: number;
  onCardBackgroundUpload: (files: FileList | null) => void;
  onCardBackgroundRemove: (id: string) => void;
  onCardTransitionTimeChange: (value: number[]) => void;
  garlandEnabled: boolean;
  onGarlandToggle: (enabled: boolean) => void;
}

const BackgroundSettings = ({ 
  backgroundOpacity, 
  onOpacityChange, 
  cardBackgroundImages,
  cardTransitionTime,
  onCardBackgroundUpload,
  onCardBackgroundRemove,
  onCardTransitionTimeChange,
  garlandEnabled,
  onGarlandToggle
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
        
        {cardBackgroundImages.length > 0 && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {cardBackgroundImages.map((image) => (
                <div key={image.id} className="relative flex-shrink-0">
                  <div className="w-24 h-24 rounded-lg overflow-hidden border">
                    <img 
                      src={image.url} 
                      alt={image.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => onCardBackgroundRemove(image.id)}
                  >
                    <Icon name="X" size={14} />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Время смены фона</Label>
                <span className="text-sm text-muted-foreground">{cardTransitionTime} сек</span>
              </div>
              <Slider
                value={[cardTransitionTime]}
                onValueChange={onCardTransitionTimeChange}
                min={3}
                max={30}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Интервал автоматической смены фоновых изображений карточки
              </p>
            </div>
          </>
        )}
        
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = (e) => onCardBackgroundUpload((e.target as HTMLInputElement).files);
            input.click();
          }}
        >
          <Icon name="Upload" size={16} className="mr-2" />
          {cardBackgroundImages.length > 0 ? 'Добавить ещё' : 'Загрузить фоны'}
        </Button>
        
        <p className="text-xs text-muted-foreground">
          Загруженные изображения будут плавно сменять друг друга на карточке входа
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Новогодняя гирлянда</Label>
            <p className="text-xs text-muted-foreground">
              Включить декоративную гирлянду на странице входа
            </p>
          </div>
          <Switch
            checked={garlandEnabled}
            onCheckedChange={onGarlandToggle}
          />
        </div>
      </div>
    </div>
  );
};

export default BackgroundSettings;