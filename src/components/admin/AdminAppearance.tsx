import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';

interface AdminAppearanceProps {
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

const AdminAppearance = ({ colors, onColorChange, onSave }: AdminAppearanceProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Цветовая схема</CardTitle>
            <CardDescription>Настройка внешнего вида сайта</CardDescription>
          </div>
          <Icon 
            name={isExpanded ? 'ChevronUp' : 'ChevronDown'} 
            className="text-muted-foreground" 
          />
        </div>
      </CardHeader>
      {isExpanded && <CardContent className="space-y-6">
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
            <Label htmlFor="backgroundColor" className="text-sm sm:text-base">Фон</Label>
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
          
          <div className="space-y-2">
            <Label htmlFor="textColor" className="text-sm sm:text-base">Текст</Label>
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
        
        <Separator />
        
        <Button onClick={onSave} className="w-full">
          <Icon name="Save" size={18} className="mr-2" />
          Сохранить цвета
        </Button>
      </CardContent>}}
    </Card>
  );
};

export default AdminAppearance;