import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import Icon from '@/components/ui/icon';
import ColorPicker from './appearance/ColorPicker';
import BackgroundSettings from './appearance/BackgroundSettings';
import BackgroundGallery, { BackgroundImage } from './appearance/BackgroundGallery';
import VideoUploader, { BackgroundVideo } from './appearance/VideoUploader';

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
  const [cardBackgroundImages, setCardBackgroundImages] = useState<BackgroundImage[]>([]);
  const [cardTransitionTime, setCardTransitionTime] = useState<number>(
    Number(localStorage.getItem('cardTransitionTime')) || 5
  );
  const [garlandEnabled, setGarlandEnabled] = useState(
    localStorage.getItem('garlandEnabled') === 'true'
  );
  const [backgroundVideos, setBackgroundVideos] = useState<BackgroundVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    localStorage.getItem('loginPageVideo') || null
  );
  const [mobileBackgroundImages, setMobileBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedMobileBackgroundId, setSelectedMobileBackgroundId] = useState<string | null>(
    localStorage.getItem('loginPageMobileBackground') || null
  );
  const { toast } = useToast();

  useState(() => {
    const savedCardImages = localStorage.getItem('cardBackgroundImages');
    if (savedCardImages) {
      setCardBackgroundImages(JSON.parse(savedCardImages));
    }
  });

  useState(() => {
    const savedImages = localStorage.getItem('backgroundImages');
    if (savedImages) {
      setBackgroundImages(JSON.parse(savedImages));
    }
  });

  useEffect(() => {
    const savedMobileImages = localStorage.getItem('mobileBackgroundImages');
    if (savedMobileImages) {
      try {
        const parsed = JSON.parse(savedMobileImages);
        setMobileBackgroundImages(parsed);
        console.log('[ADMIN_APPEARANCE] Loaded mobile backgrounds:', parsed);
      } catch (e) {
        console.error('[ADMIN_APPEARANCE] Failed to parse mobile backgrounds:', e);
        localStorage.removeItem('mobileBackgroundImages');
      }
    }
  }, []);

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
    
    // Убираем видео если выбрано изображение
    if (selectedVideoId) {
      setSelectedVideoId(null);
      localStorage.removeItem('loginPageVideo');
      window.dispatchEvent(new CustomEvent('backgroundVideoChange', { detail: null }));
    }
    
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

  const handleCardBackgroundUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: BackgroundImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = (e) => {
          newImages.push({
            id: `card-bg-${Date.now()}-${i}`,
            url: e.target?.result as string,
            name: file.name,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    const updatedImages = [...cardBackgroundImages, ...newImages];
    setCardBackgroundImages(updatedImages);
    localStorage.setItem('cardBackgroundImages', JSON.stringify(updatedImages));
    
    toast({
      title: 'Фоны карточки добавлены',
      description: `Загружено ${newImages.length} изображений`,
    });
  };

  const handleCardBackgroundRemove = (id: string) => {
    const updatedImages = cardBackgroundImages.filter(img => img.id !== id);
    setCardBackgroundImages(updatedImages);
    localStorage.setItem('cardBackgroundImages', JSON.stringify(updatedImages));
    
    toast({
      title: 'Фон карточки удалён',
      description: 'Изображение удалено из галереи',
    });
  };

  const handleCardTransitionTimeChange = (value: number[]) => {
    const time = value[0];
    setCardTransitionTime(time);
    localStorage.setItem('cardTransitionTime', time.toString());
    window.dispatchEvent(new CustomEvent('cardTransitionTimeChange', { detail: time }));
  };

  const handleGarlandToggle = (enabled: boolean) => {
    setGarlandEnabled(enabled);
    localStorage.setItem('garlandEnabled', enabled.toString());
    window.dispatchEvent(new CustomEvent('garlandToggle', { detail: enabled }));
    sonnerToast.success(enabled ? '🎄 Гирлянда включена' : 'Гирлянда выключена');
  };

  const handleVideosChange = (videos: BackgroundVideo[]) => {
    setBackgroundVideos(videos);
  };

  const handleSelectVideo = (videoId: string | null) => {
    setSelectedVideoId(videoId);
    if (videoId) {
      const selectedVideo = backgroundVideos.find(v => v.id === videoId);
      localStorage.setItem('loginPageVideo', videoId);
      
      if (selectedVideo) {
        // Сохраняем URL для быстрого доступа
        localStorage.setItem('loginPageVideoUrl', selectedVideo.url);
        // Получаем мобильную версию из localStorage
        const mobileUrl = localStorage.getItem('loginPageMobileVideoUrl');
        // Отправляем событие с ID, URL и mobileUrl
        window.dispatchEvent(new CustomEvent('backgroundVideoChange', { 
          detail: { id: videoId, url: selectedVideo.url, mobileUrl } 
        }));
      } else {
        // Fallback: только ID (для старых данных)
        window.dispatchEvent(new CustomEvent('backgroundVideoChange', { detail: { id: videoId } }));
      }
      
      // Убираем фоновое изображение если выбрано видео
      setSelectedBackgroundId(null);
      localStorage.removeItem('loginPageBackground');
      sonnerToast.success('Фоновое видео применено');
    } else {
      localStorage.removeItem('loginPageVideo');
      localStorage.removeItem('loginPageVideoUrl');
      window.dispatchEvent(new CustomEvent('backgroundVideoChange', { detail: null }));
      sonnerToast.info('Фоновое видео отключено');
    }
  };

  const handleRemoveVideo = (videoId: string) => {
    const updatedVideos = backgroundVideos.filter(v => v.id !== videoId);
    setBackgroundVideos(updatedVideos);
    
    if (selectedVideoId === videoId) {
      setSelectedVideoId(null);
      localStorage.removeItem('loginPageVideo');
      localStorage.removeItem('loginPageVideoUrl');
      window.dispatchEvent(new CustomEvent('backgroundVideoChange', { detail: null }));
    }
  };

  const handleMobileBackgroundUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    sonnerToast.loading('Загрузка изображений...', { id: 'mobile-upload' });

    try {
      const uploadedImages: BackgroundImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        // Читаем файл как base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1]; // Убираем "data:image/...;base64,"
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Отправляем на сервер
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64Data,
            filename: file.name,
            type: 'image',
          }),
        });

        const data = await response.json();
        
        if (data.success && data.file) {
          uploadedImages.push({
            id: data.file.id,
            url: data.file.url,
            name: file.name,
          });
        }
      }

      const updatedImages = [...mobileBackgroundImages, ...uploadedImages];
      setMobileBackgroundImages(updatedImages);
      
      // Сохраняем только метаданные, НЕ сами изображения
      const imagesMetadata = updatedImages.map(img => ({
        id: img.id,
        url: img.url,
        name: img.name
      }));
      localStorage.setItem('mobileBackgroundImages', JSON.stringify(imagesMetadata));

      sonnerToast.success(`Добавлено ${uploadedImages.length} изображений`, { id: 'mobile-upload' });
    } catch (error) {
      console.error('Mobile background upload error:', error);
      sonnerToast.error('Ошибка загрузки', { id: 'mobile-upload' });
    }
  };

  const handleSelectMobileBackground = (imageId: string) => {
    setSelectedMobileBackgroundId(imageId);
    const selectedImage = mobileBackgroundImages.find(img => img.id === imageId);
    
    if (selectedImage) {
      localStorage.setItem('loginPageMobileBackground', imageId);
      localStorage.setItem('loginPageMobileBackgroundUrl', selectedImage.url);
      window.dispatchEvent(new CustomEvent('mobileBackgroundChange', { detail: selectedImage.url }));
      sonnerToast.success('Мобильный фон применен');
    }
  };

  const handleRemoveMobileBackground = (imageId: string) => {
    const updatedImages = mobileBackgroundImages.filter(img => img.id !== imageId);
    setMobileBackgroundImages(updatedImages);
    localStorage.setItem('mobileBackgroundImages', JSON.stringify(updatedImages));
    
    if (selectedMobileBackgroundId === imageId) {
      setSelectedMobileBackgroundId(null);
      localStorage.removeItem('loginPageMobileBackground');
      localStorage.removeItem('loginPageMobileBackgroundUrl');
      window.dispatchEvent(new CustomEvent('mobileBackgroundChange', { detail: null }));
    }

    sonnerToast.success('Мобильное изображение удалено');
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
          cardBackgroundImages={cardBackgroundImages}
          cardTransitionTime={cardTransitionTime}
          onCardBackgroundUpload={handleCardBackgroundUpload}
          onCardBackgroundRemove={handleCardBackgroundRemove}
          onCardTransitionTimeChange={handleCardTransitionTimeChange}
          garlandEnabled={garlandEnabled}
          onGarlandToggle={handleGarlandToggle}
        />

        <Separator />

        <VideoUploader
          videos={backgroundVideos}
          selectedVideoId={selectedVideoId}
          onVideosChange={handleVideosChange}
          onSelectVideo={handleSelectVideo}
          onRemoveVideo={handleRemoveVideo}
        />

        <Separator />

        <div>
          <h3 className="text-lg font-semibold mb-2">Мобильный фон (картинка/GIF)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            На мобильных устройствах вместо видео будет показываться эта картинка или GIF
          </p>
          
          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleMobileBackgroundUpload(e.target.files)}
                className="hidden"
                id="mobile-bg-upload"
              />
              <label
                htmlFor="mobile-bg-upload"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer transition-colors"
              >
                <Icon name="Upload" size={20} />
                Загрузить картинку/GIF для мобильных
              </label>
            </div>

            {mobileBackgroundImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {mobileBackgroundImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedMobileBackgroundId === image.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-primary/50'
                    }`}
                    onClick={() => handleSelectMobileBackground(image.id)}
                  >
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-32 object-cover"
                    />
                    {selectedMobileBackgroundId === image.id && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Icon name="Check" size={16} />
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveMobileBackground(image.id);
                      }}
                      className="absolute bottom-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 truncate">
                      {image.name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mobileBackgroundImages.length === 0 && (
              <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                <Icon name="ImagePlus" size={48} className="mx-auto mb-2 opacity-50" />
                <p>Загрузите картинку или GIF для мобильных устройств</p>
              </div>
            )}
          </div>
        </div>

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