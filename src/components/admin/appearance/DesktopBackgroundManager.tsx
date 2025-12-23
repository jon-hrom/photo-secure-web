import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import BackgroundGallery, { BackgroundImage } from './BackgroundGallery';

interface DesktopBackgroundManagerProps {
  backgroundImages: BackgroundImage[];
  setBackgroundImages: (images: BackgroundImage[]) => void;
  selectedBackgroundId: string | null;
  setSelectedBackgroundId: (id: string | null) => void;
  backgroundOpacity: number;
  selectedVideoId: string | null;
  setSelectedVideoId: (id: string | null) => void;
}

const DesktopBackgroundManager = ({
  backgroundImages,
  setBackgroundImages,
  selectedBackgroundId,
  setSelectedBackgroundId,
  backgroundOpacity,
  selectedVideoId,
  setSelectedVideoId,
}: DesktopBackgroundManagerProps) => {
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BackgroundImage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

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

  return (
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
  );
};

export default DesktopBackgroundManager;
