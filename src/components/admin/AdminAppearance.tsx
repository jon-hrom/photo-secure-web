import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
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

interface BackgroundImage {
  id: string;
  url: string;
  name: string;
}

const AdminAppearance = ({ colors, onColorChange, onSave }: AdminAppearanceProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(
    localStorage.getItem('loginPageBackground') || null
  );
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useState(() => {
    const savedImages = localStorage.getItem('backgroundImages');
    if (savedImages) {
      setBackgroundImages(JSON.parse(savedImages));
    }
  });

  const handleBackgroundUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploadingBg(true);
    const newImages: BackgroundImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = (e) => {
          newImages.push({
            id: `bg-${Date.now()}-${i}`,
            url: e.target?.result as string,
            name: file.name,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    const updatedImages = [...backgroundImages, ...newImages];
    setBackgroundImages(updatedImages);
    localStorage.setItem('backgroundImages', JSON.stringify(updatedImages));
    setIsUploadingBg(false);

    toast({
      title: 'Изображения загружены',
      description: `Добавлено ${newImages.length} фоновых изображений`,
    });
  };

  const handleSelectBackground = (imageId: string) => {
    setSelectedBackgroundId(imageId);
    localStorage.setItem('loginPageBackground', imageId);
    
    toast({
      title: 'Фон применен',
      description: 'Фон страницы входа обновлен',
    });
  };

  const handleRemoveBackground = (imageId: string) => {
    const updatedImages = backgroundImages.filter(img => img.id !== imageId);
    setBackgroundImages(updatedImages);
    localStorage.setItem('backgroundImages', JSON.stringify(updatedImages));
    
    if (selectedBackgroundId === imageId) {
      setSelectedBackgroundId(null);
      localStorage.removeItem('loginPageBackground');
    }

    toast({
      title: 'Изображение удалено',
      description: 'Фоновое изображение удалено',
    });
  };

  const getSelectedBackgroundUrl = () => {
    if (!selectedBackgroundId) return null;
    const selectedImage = backgroundImages.find(img => img.id === selectedBackgroundId);
    return selectedImage?.url || null;
  };

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

        <Separator className="my-6" />

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Фон страницы входа</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Загрузите изображения для фона страницы входа на сайт
            </p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
            <div className="space-y-3">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Icon name="Image" size={32} className="text-primary" />
              </div>
              <div>
                <p className="font-medium mb-1">Загрузить фоновые изображения</p>
                <p className="text-sm text-muted-foreground">
                  JPG, PNG, WEBP (рекомендуется 1920x1080)
                </p>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingBg}
                className="rounded-full"
              >
                {isUploadingBg ? (
                  <>
                    <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <Icon name="Upload" size={18} className="mr-2" />
                    Выбрать файлы
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleBackgroundUpload(e.target.files)}
              />
            </div>
          </div>

          {backgroundImages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Доступные фоны ({backgroundImages.length})</h4>
                {selectedBackgroundId && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <Icon name="CheckCircle" size={16} />
                    <span>Фон применен</span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {backgroundImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedBackgroundId === image.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-gray-200 hover:border-primary'
                    }`}
                    onClick={() => handleSelectBackground(image.id)}
                  >
                    <div className="aspect-video bg-gray-100">
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {selectedBackgroundId === image.id && (
                      <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
                        <Icon name="Check" size={16} />
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBackground(image.id);
                      }}
                      className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon name="X" size={16} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">
                      {image.name}
                    </div>
                  </div>
                ))}
              </div>

              {getSelectedBackgroundUrl() && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Предпросмотр текущего фона:</p>
                  <div className="aspect-video rounded-lg overflow-hidden border-2 border-primary">
                    <img
                      src={getSelectedBackgroundUrl()!}
                      alt="Текущий фон"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>}
    </Card>
  );
};

export default AdminAppearance;