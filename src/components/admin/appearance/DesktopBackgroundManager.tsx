import { useEffect, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import Icon from '@/components/ui/icon';
import { BackgroundImage } from './BackgroundGallery';
import funcUrls from '../../../../backend/func2url.json';

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
  const API_URL = funcUrls['background-media'];
  const SETTINGS_API = funcUrls['background-settings'];
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BackgroundImage[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const saveToDb = async (images: BackgroundImage[], selectedId: string | null) => {
    try {
      await fetch(SETTINGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desktopImages: images.map(img => ({ id: img.id, url: img.url, name: img.name })),
          desktopSelectedId: selectedId || '',
          imageId: selectedId || '',
          imageUrl: selectedId ? (images.find(i => i.id === selectedId)?.url || '') : '',
          opacity: backgroundOpacity
        })
      });
    } catch (e) {
      console.error('[DESKTOP_BG] Failed to save to DB:', e);
    }
  };

  const handleBackgroundUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    sonnerToast.loading('Загрузка изображений...', { id: 'desktop-upload' });

    try {
      const uploadedImages: BackgroundImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64Data, filename: file.name, type: 'image' }),
        });

        const data = await response.json();
        if (data.success && data.file) {
          uploadedImages.push({ id: data.file.id, url: data.file.url, name: file.name });
        }
      }

      const updatedImages = [...backgroundImages, ...uploadedImages];
      setBackgroundImages(updatedImages);
      await saveToDb(updatedImages, selectedBackgroundId);

      sonnerToast.success(`Добавлено ${uploadedImages.length} изображений`, { id: 'desktop-upload' });
    } catch (error) {
      console.error('Desktop background upload error:', error);
      sonnerToast.error('Ошибка загрузки', { id: 'desktop-upload' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectBackground = async (imageId: string) => {
    setSelectedBackgroundId(imageId);
    localStorage.setItem('loginPageBackground', imageId);

    if (selectedVideoId) {
      setSelectedVideoId(null);
      localStorage.removeItem('loginPageVideo');
      window.dispatchEvent(new CustomEvent('backgroundVideoChange', { detail: null }));
    }

    const selectedImage = backgroundImages.find(img => img.id === imageId);
    if (selectedImage) {
      localStorage.setItem('loginPageBackgroundUrl', selectedImage.url);
      window.dispatchEvent(new CustomEvent('desktopBackgroundChange', { detail: selectedImage.url }));
    }

    await saveToDb(backgroundImages, imageId);
    sonnerToast.success('Фон применен');
  };

  const handleSearchImages = async () => {
    if (!searchQuery.trim()) {
      sonnerToast.error('Введите поисковый запрос');
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=20&orientation=landscape`,
        { headers: { Authorization: 'gVZM9g4F4wKz8Mv6T95F2B0kVGrTXbqeVYa8Iz6FGzVMk0veBNrOPBzi' } }
      );
      const data = await response.json();
      if (!data.photos || data.photos.length === 0) {
        sonnerToast.error('Ничего не найдено');
        setSearchResults([]);
        return;
      }
      setSearchResults(data.photos.map((photo: { id: number; src: { large: string }; alt: string }) => ({
        id: `pexels-${photo.id}`,
        url: photo.src.large,
        name: photo.alt || 'Pexels Image',
      })));
      sonnerToast.success(`Найдено ${data.photos.length} изображений`);
    } catch {
      sonnerToast.error('Ошибка поиска');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFromSearch = async (image: BackgroundImage) => {
    const updatedImages = [...backgroundImages, image];
    setBackgroundImages(updatedImages);
    await saveToDb(updatedImages, selectedBackgroundId);
    sonnerToast.success('Изображение добавлено');
  };

  const handleRemoveBackground = async (imageId: string) => {
    const updatedImages = backgroundImages.filter(img => img.id !== imageId);
    setBackgroundImages(updatedImages);

    const newSelectedId = selectedBackgroundId === imageId ? null : selectedBackgroundId;
    if (selectedBackgroundId === imageId) {
      setSelectedBackgroundId(null);
      localStorage.removeItem('loginPageBackground');
      localStorage.removeItem('loginPageBackgroundUrl');
      window.dispatchEvent(new CustomEvent('desktopBackgroundChange', { detail: null }));
    }

    await saveToDb(updatedImages, newSelectedId);
    sonnerToast.success('Изображение удалено');
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Фон страницы входа (десктоп)</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Фоновое изображение для десктопных браузеров. Сохраняется на сервере и работает на всех устройствах.
      </p>

      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearchImages()}
            placeholder="Поиск изображений (Pexels)..."
            className="flex-1 px-3 py-2 border rounded-md text-sm"
          />
          <button
            onClick={handleSearchImages}
            disabled={isSearching}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 text-sm transition-colors disabled:opacity-50"
          >
            {isSearching ? 'Поиск...' : 'Найти'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Результаты поиска:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {searchResults.map(image => (
                <div key={image.id} className="relative group cursor-pointer rounded overflow-hidden border" onClick={() => handleAddFromSearch(image)}>
                  <img src={image.url} alt={image.name} className="w-full h-20 object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Icon name="Plus" size={20} className="text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={e => handleBackgroundUpload(e.target.files)}
            className="hidden"
            id="desktop-bg-upload"
          />
          <label
            htmlFor="desktop-bg-upload"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer transition-colors"
          >
            <Icon name={isUploading ? 'Loader' : 'Upload'} size={20} className={isUploading ? 'animate-spin' : ''} />
            {isUploading ? 'Загрузка...' : 'Загрузить изображение'}
          </label>
        </div>

        {backgroundImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {backgroundImages.map(image => (
              <div
                key={image.id}
                className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  selectedBackgroundId === image.id
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-primary/50'
                }`}
                onClick={() => handleSelectBackground(image.id)}
              >
                <img src={image.url} alt={image.name} className="w-full h-32 object-cover" />
                {selectedBackgroundId === image.id && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Icon name="Check" size={16} />
                  </div>
                )}
                <button
                  onClick={e => { e.stopPropagation(); handleRemoveBackground(image.id); }}
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

        {backgroundImages.length === 0 && (
          <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
            <Icon name="ImagePlus" size={48} className="mx-auto mb-2 opacity-50" />
            <p>Загрузите изображение или найдите через поиск</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopBackgroundManager;