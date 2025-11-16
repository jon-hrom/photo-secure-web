import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ColorPickerProps {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  onColorChange: (key: string, value: string) => void;
  onSave: () => void;
}

const ColorPicker = ({ colors, onColorChange, onSave }: ColorPickerProps) => {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="primaryColor" className="text-sm sm:text-base">Основной цвет</Label>
          <div className="flex items-center gap-2">
            <Input
              id="primaryColor"
              type="color"
              value={colors.primary}
              onChange={(e) => onColorChange('primary', e.target.value)}
              className="w-20 h-10"
            />
            <Input
              type="text"
              value={colors.primary}
              onChange={(e) => onColorChange('primary', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="secondaryColor" className="text-sm sm:text-base">Вторичный цвет</Label>
          <div className="flex items-center gap-2">
            <Input
              id="secondaryColor"
              type="color"
              value={colors.secondary}
              onChange={(e) => onColorChange('secondary', e.target.value)}
              className="w-20 h-10"
            />
            <Input
              type="text"
              value={colors.secondary}
              onChange={(e) => onColorChange('secondary', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="accentColor" className="text-sm sm:text-base">Акцентный цвет</Label>
          <div className="flex items-center gap-2">
            <Input
              id="accentColor"
              type="color"
              value={colors.accent}
              onChange={(e) => onColorChange('accent', e.target.value)}
              className="w-20 h-10"
            />
            <Input
              type="text"
              value={colors.accent}
              onChange={(e) => onColorChange('accent', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="backgroundColor" className="text-sm sm:text-base">Цвет фона</Label>
          <div className="flex items-center gap-2">
            <Input
              id="backgroundColor"
              type="color"
              value={colors.background}
              onChange={(e) => onColorChange('background', e.target.value)}
              className="w-20 h-10"
            />
            <Input
              type="text"
              value={colors.background}
              onChange={(e) => onColorChange('background', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
        
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="textColor" className="text-sm sm:text-base">Цвет текста</Label>
          <div className="flex items-center gap-2">
            <Input
              id="textColor"
              type="color"
              value={colors.text}
              onChange={(e) => onColorChange('text', e.target.value)}
              className="w-20 h-10"
            />
            <Input
              type="text"
              value={colors.text}
              onChange={(e) => onColorChange('text', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <Button onClick={onSave} className="w-full sm:w-auto">
        Сохранить изменения
      </Button>
    </>
  );
};

export default ColorPicker;
