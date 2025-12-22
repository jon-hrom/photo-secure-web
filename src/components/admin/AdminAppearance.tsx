import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import Icon from '@/components/ui/icon';
import ColorPicker from './appearance/ColorPicker';
import BackgroundSettings from './appearance/BackgroundSettings';
import BackgroundGallery, { BackgroundImage } from './appearance/BackgroundGallery';

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
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(
    localStorage.getItem('loginPageBackground') || null
  );
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(
    Number(localStorage.getItem('loginPageBackgroundOpacity')) || 20
  );
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BackgroundImage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [newYearMode, setNewYearMode] = useState(
    localStorage.getItem('newYearMode') === 'true'
  );
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

  const handleOpacityChange = (value: number[]) => {
    const opacity = value[0];
    setBackgroundOpacity(opacity);
    localStorage.setItem('loginPageBackgroundOpacity', opacity.toString());
  };

  const handleSearchImages = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите поисковый запрос',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=20&orientation=landscape`,
        {
          headers: {
            Authorization: 'gVZM9g4F4wKz8Mv6T95F2B0kVGrTXbqeVYa8Iz6FGzVMk0veBNrOPBzi'
          }
        }
      );

      if (!response.ok) {
        console.error('Pexels API error:', response.status, response.statusText);
        throw new Error('Search failed');
      }

      const data = await response.json();
      console.log('Pexels response:', data);

      if (!data.photos || data.photos.length === 0) {
        toast({
          title: 'Ничего не найдено',
          description: 'Попробуйте другой запрос',
        });
        setSearchResults([]);
        return;
      }

      const results: BackgroundImage[] = data.photos.map((photo: any) => ({
        id: `pexels-${photo.id}`,
        url: photo.src.large,
        name: photo.alt || 'Pexels Image',
      }));

      setSearchResults(results);
      toast({
        title: 'Поиск завершен',
        description: `Найдено ${results.length} изображений`,
      });
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Ошибка поиска',
        description: 'Не удалось найти изображения. Попробуйте позже.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFromSearch = (image: BackgroundImage) => {
    const updatedImages = [...backgroundImages, image];
    setBackgroundImages(updatedImages);
    localStorage.setItem('backgroundImages', JSON.stringify(updatedImages));
    
    toast({
      title: 'Изображение добавлено',
      description: 'Фон добавлен в вашу библиотеку',
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

  const handleNewYearModeChange = (enabled: boolean) => {
    setNewYearMode(enabled);
    localStorage.setItem('newYearMode', enabled.toString());
    window.dispatchEvent(new CustomEvent('newYearModeChange', { detail: enabled }));
    sonnerToast.success(enabled ? '🎄 Новогодний дизайн включён!' : 'Новогодний дизайн выключен');
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
        <ColorPicker 
          colors={colors}
          onColorChange={onColorChange}
          onSave={onSave}
        />

        <Separator />

        <BackgroundSettings
          backgroundOpacity={backgroundOpacity}
          onOpacityChange={handleOpacityChange}
        />

        <Separator />

        <BackgroundGallery
          backgroundImages={backgroundImages}
          selectedBackgroundId={selectedBackgroundId}
          backgroundOpacity={backgroundOpacity}
          isUploadingBg={isUploadingBg}
          searchQuery={searchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          onBackgroundUpload={handleBackgroundUpload}
          onSelectBackground={handleSelectBackground}
          onRemoveBackground={handleRemoveBackground}
          onSearchQueryChange={setSearchQuery}
          onSearchImages={handleSearchImages}
          onAddFromSearch={handleAddFromSearch}
          getSelectedBackgroundUrl={getSelectedBackgroundUrl}
        />

        <Separator />

        <div>
          <h3 className="text-lg font-semibold mb-4">Новогодний дизайн</h3>
          <label className="flex items-center justify-between cursor-pointer group p-4 rounded-lg border border-gray-200 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🎄</div>
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Включить новогодний режим
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Гирлянды, снежинки и праздничное настроение
                </div>
              </div>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={newYearMode}
                onChange={(e) => handleNewYearModeChange(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-red-500 peer-checked:to-green-500 transition-all"></div>
              <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-5 shadow-md"></div>
            </div>
          </label>
        </div>
      </CardContent>}
    </Card>
  );
};

export default AdminAppearance;