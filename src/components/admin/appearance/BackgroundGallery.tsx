import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';

export interface BackgroundImage {
  id: string;
  url: string;
  name: string;
}

interface BackgroundGalleryProps {
  backgroundImages: BackgroundImage[];
  selectedBackgroundId: string | null;
  backgroundOpacity: number;
  isUploadingBg: boolean;
  searchQuery: string;
  searchResults: BackgroundImage[];
  isSearching: boolean;
  onBackgroundUpload: (files: FileList | null) => void;
  onSelectBackground: (imageId: string) => void;
  onRemoveBackground: (imageId: string) => void;
  onSearchQueryChange: (query: string) => void;
  onSearchImages: () => void;
  onAddFromSearch: (image: BackgroundImage) => void;
  getSelectedBackgroundUrl: () => string | null;
}

const BackgroundGallery = ({
  backgroundImages,
  selectedBackgroundId,
  backgroundOpacity,
  isUploadingBg,
  searchQuery,
  searchResults,
  isSearching,
  onBackgroundUpload,
  onSelectBackground,
  onRemoveBackground,
  onSearchQueryChange,
  onSearchImages,
  onAddFromSearch,
  getSelectedBackgroundUrl,
}: BackgroundGalleryProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Фоновое изображение страницы входа</h3>
      
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Загрузить</TabsTrigger>
          <TabsTrigger value="search">Поиск онлайн</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="space-y-4">
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onBackgroundUpload(e.target.files)}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingBg}
              variant="outline"
              className="w-full"
            >
              <Icon name="Upload" className="mr-2" size={16} />
              {isUploadingBg ? 'Загрузка...' : 'Загрузить изображения'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Можно загрузить несколько изображений одновременно
            </p>
          </div>
        </TabsContent>
        
        <TabsContent value="search" className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Поиск изображений (например: природа, офис)"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearchImages();
                  }
                }}
              />
              <Button
                onClick={onSearchImages}
                disabled={isSearching}
                variant="outline"
              >
                <Icon name="Search" size={16} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Поиск бесплатных изображений на Pixabay
            </p>
          </div>
          
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Результаты поиска ({searchResults.length})</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {searchResults.map((image) => {
                  const isAdded = backgroundImages.some(bg => bg.id === image.id);
                  return (
                    <div
                      key={image.id}
                      className="relative group rounded-lg overflow-hidden border-2 border-gray-200"
                    >
                      <div className="aspect-video bg-gray-100">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onAddFromSearch(image)}
                        disabled={isAdded}
                        className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {isAdded ? (
                          <>
                            <Icon name="Check" size={14} className="mr-1" />
                            Добавлено
                          </>
                        ) : (
                          <>
                            <Icon name="Plus" size={14} className="mr-1" />
                            Добавить
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
                onClick={() => onSelectBackground(image.id)}
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
                    onRemoveBackground(image.id);
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
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <p className="text-sm font-medium">Предпросмотр текущего фона с затемнением:</p>
              <div className="aspect-video rounded-lg overflow-hidden border-2 border-primary relative">
                <img
                  src={getSelectedBackgroundUrl()!}
                  alt="Текущий фон"
                  className="w-full h-full object-cover"
                />
                <div 
                  className="absolute inset-0 backdrop-blur-sm"
                  style={{
                    backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity / 100})`
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/95 rounded-xl p-6 shadow-lg">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Icon name="Lock" size={24} className="text-primary" />
                      </div>
                      <p className="font-semibold text-sm">Форма входа</p>
                      <p className="text-xs text-muted-foreground">Предпросмотр</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Так будет выглядеть страница входа с текущими настройками
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BackgroundGallery;