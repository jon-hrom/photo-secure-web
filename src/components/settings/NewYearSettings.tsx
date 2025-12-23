import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';

export interface SnowSettings {
  enabled: boolean;
  speed: number;
  size: number;
  direction: 'down' | 'left' | 'right' | 'auto';
  colors: {
    white: number;
    blue: number;
    black: number;
    yellow: number;
    red: number;
    green: number;
  };
}

interface NewYearSettingsProps {
  settings: SnowSettings;
  onChange: (settings: SnowSettings) => void;
}

const NewYearSettings = ({ settings, onChange }: NewYearSettingsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = () => {
    onChange({ ...settings, enabled: !settings.enabled });
  };

  const handleSpeedChange = (value: number[]) => {
    onChange({ ...settings, speed: value[0] });
  };

  const handleSizeChange = (value: number[]) => {
    onChange({ ...settings, size: value[0] });
  };

  const handleDirectionChange = (value: string) => {
    onChange({ ...settings, direction: value as SnowSettings['direction'] });
  };

  const handleColorChange = (color: keyof SnowSettings['colors'], value: number[]) => {
    onChange({
      ...settings,
      colors: { ...settings.colors, [color]: value[0] }
    });
  };

  const totalColors = Object.values(settings.colors).reduce((sum, val) => sum + val, 0);

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              🎄 Новогодний интерьер
            </CardTitle>
            <CardDescription>
              Настройка снега и новогоднего оформления
            </CardDescription>
          </div>
          <Icon 
            name={isExpanded ? 'ChevronUp' : 'ChevronDown'} 
            className="text-muted-foreground" 
          />
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="newYearEnabled">Включить новогоднее оформление</Label>
              <p className="text-sm text-muted-foreground">
                Снежинки и праздничные украшения
              </p>
            </div>
            <Switch
              id="newYearEnabled"
              checked={settings.enabled}
              onCheckedChange={handleToggle}
            />
          </div>

          {settings.enabled && (
            <>
              <Separator />
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Скорость снега</Label>
                  <span className="text-sm text-muted-foreground">{settings.speed}x</span>
                </div>
                <Slider
                  value={[settings.speed]}
                  onValueChange={handleSpeedChange}
                  min={0.5}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  От медленного падения до быстрой метели
                </p>
              </div>

              <Separator />
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Размер снежинок</Label>
                  <span className="text-sm text-muted-foreground">{settings.size}px</span>
                </div>
                <Slider
                  value={[settings.size]}
                  onValueChange={handleSizeChange}
                  min={10}
                  max={40}
                  step={2}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Размер снежинок от мелких до крупных хлопьев
                </p>
              </div>

              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="direction">Направление падения</Label>
                <Select value={settings.direction} onValueChange={handleDirectionChange}>
                  <SelectTrigger id="direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="down">⬇️ Прямо вниз</SelectItem>
                    <SelectItem value="left">↙️ Влево</SelectItem>
                    <SelectItem value="right">↘️ Вправо</SelectItem>
                    <SelectItem value="auto">🔄 Автоматическое</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {settings.direction === 'auto' ? 'Снежинки летят в разные стороны' : 'Все снежинки летят в одном направлении'}
                </p>
              </div>

              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Цвета снежинок</Label>
                  <span className="text-sm text-muted-foreground">Всего: {totalColors}%</span>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-white border"></div>
                        Белые
                      </Label>
                      <span className="text-sm">{settings.colors.white}%</span>
                    </div>
                    <Slider
                      value={[settings.colors.white]}
                      onValueChange={(val) => handleColorChange('white', val)}
                      max={100}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-400"></div>
                        Синие
                      </Label>
                      <span className="text-sm">{settings.colors.blue}%</span>
                    </div>
                    <Slider
                      value={[settings.colors.blue]}
                      onValueChange={(val) => handleColorChange('blue', val)}
                      max={100}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
                        Жёлтые
                      </Label>
                      <span className="text-sm">{settings.colors.yellow}%</span>
                    </div>
                    <Slider
                      value={[settings.colors.yellow]}
                      onValueChange={(val) => handleColorChange('yellow', val)}
                      max={100}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-400"></div>
                        Красные
                      </Label>
                      <span className="text-sm">{settings.colors.red}%</span>
                    </div>
                    <Slider
                      value={[settings.colors.red]}
                      onValueChange={(val) => handleColorChange('red', val)}
                      max={100}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-400"></div>
                        Зелёные
                      </Label>
                      <span className="text-sm">{settings.colors.green}%</span>
                    </div>
                    <Slider
                      value={[settings.colors.green]}
                      onValueChange={(val) => handleColorChange('green', val)}
                      max={100}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-black border"></div>
                        Чёрные
                      </Label>
                      <span className="text-sm">{settings.colors.black}%</span>
                    </div>
                    <Slider
                      value={[settings.colors.black]}
                      onValueChange={(val) => handleColorChange('black', val)}
                      max={100}
                      step={5}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  💡 Процентное соотношение цветов снежинок (общая сумма может превышать 100%)
                </p>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default NewYearSettings;
