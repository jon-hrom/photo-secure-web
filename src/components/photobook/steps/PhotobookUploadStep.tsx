import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import type { UploadedPhoto } from '../PhotobookCreator';

interface PhotobookUploadStepProps {
  requiredPhotos: number;
  onComplete: (photos: UploadedPhoto[]) => void;
  onBack: () => void;
}

interface Album {
  id: string;
  name: string;
  count: number;
}

const PhotobookUploadStep = ({ requiredPhotos, onComplete, onBack }: PhotobookUploadStepProps) => {
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [albums] = useState<Album[]>([
    { id: 'all', name: 'Все мои файлы', count: 6 },
    { id: 'new', name: 'Новые загрузки', count: 0 },
    { id: 'today', name: 'Загруженные сегодня', count: 0 },
    { id: 'no-album', name: 'Без альбома', count: 6 },
  ]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const photo: UploadedPhoto = {
            id: `photo-${Date.now()}-${Math.random()}`,
            url: e.target?.result as string,
            file,
            width: img.width,
            height: img.height,
          };
          setUploadedPhotos(prev => [...prev, photo]);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedPhotos(new Set(uploadedPhotos.map(p => p.id)));
  };

  const handleContinue = () => {
    const selected = uploadedPhotos.filter(p => selectedPhotos.has(p.id));
    onComplete(selected);
  };

  return (
    <div className="h-[85vh] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-xl font-bold">Выберите фотографии</h2>
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="X" size={24} />
        </Button>
      </div>

      <Tabs defaultValue="my-files" className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="my-files" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-400 rounded-none">
              <Icon name="Folder" size={18} className="mr-2" />
              Мои файлы
            </TabsTrigger>
            <TabsTrigger value="photobank" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-400 rounded-none">
              <Icon name="Landmark" size={18} className="mr-2" />
              Фотобанк
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="my-files" className="flex-1 flex flex-col m-0">
          <div className="grid grid-cols-[250px_1fr] flex-1 overflow-hidden">
            <div className="border-r p-4 overflow-y-auto">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Дата загрузки файлов</h3>
                {albums.map(album => (
                  <div 
                    key={album.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer"
                  >
                    <span className="text-sm">{album.name}</span>
                    <span className="text-xs text-muted-foreground">{album.count}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">Мои альбомы</h3>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Icon name="Plus" size={16} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Вы еще не создали ни одного альбома
                </p>
              </div>
            </div>

            <div className="flex flex-col overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between gap-4">
                <div className="flex-1 relative">
                  <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Поиск изображений"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button 
                  variant="outline"
                  onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
                >
                  <Icon name={view === 'grid' ? 'List' : 'Grid3x3'} size={18} />
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon">
                    <Icon name="MoreVertical" size={18} />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Icon name="ArrowDownUp" size={18} />
                  </Button>
                  <Button 
                    variant="outline"
                    disabled={uploadedPhotos.length === 0}
                    onClick={selectAll}
                  >
                    <Icon name="CheckSquare" size={18} className="mr-2" />
                    Выделить все файлы
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {uploadedPhotos.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Icon name="ImageOff" size={64} className="mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">Загрузите фотографии для вашей фотокниги</p>
                      <label htmlFor="file-upload">
                        <Button className="bg-yellow-400 hover:bg-yellow-500 text-black" asChild>
                          <span>
                            <Icon name="Upload" size={18} className="mr-2" />
                            Загрузить файлы
                          </span>
                        </Button>
                      </label>
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>
                ) : (
                  <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 items-start' : 'space-y-2'}>
                    {uploadedPhotos.map(photo => {
                      const isVertical = photo.height > photo.width;
                      const isHorizontal = photo.width > photo.height;
                      
                      return (
                        <Card
                          key={photo.id}
                          className={`cursor-pointer transition-all hover:shadow-lg relative ${
                            selectedPhotos.has(photo.id) ? 'ring-4 ring-blue-400' : ''
                          }`}
                          onClick={() => togglePhotoSelection(photo.id)}
                        >
                          {view === 'grid' ? (
                            <div 
                              className="relative overflow-hidden bg-gray-50" 
                              style={{ 
                                height: isVertical ? '240px' : isHorizontal ? '160px' : '200px',
                                width: '100%'
                              }}
                            >
                              <img 
                                src={photo.url} 
                                alt="Uploaded"
                                className={`w-full h-full object-contain transition-opacity ${
                                  selectedPhotos.has(photo.id) ? 'opacity-90' : ''
                                }`}
                              />
                            {selectedPhotos.has(photo.id) && (
                              <>
                                <div className="absolute inset-0 bg-blue-500/20" />
                                <div className="absolute top-2 left-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                  <Icon name="Check" size={20} className="text-white" />
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-2">
                            <div className="w-16 h-16 relative overflow-hidden rounded">
                              <img 
                                src={photo.url} 
                                alt="Uploaded"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{photo.file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {photo.width} × {photo.height}
                              </p>
                            </div>
                            {selectedPhotos.has(photo.id) && (
                              <Icon name="CheckCircle2" size={20} className="text-yellow-400" />
                            )}
                          </div>
                        )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="photobank" className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Icon name="Image" size={64} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Фотобанк пока недоступен</p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="border-t p-4 flex items-center justify-between bg-gray-50">
        <div className="text-sm">
          <span className="font-semibold">{selectedPhotos.size}</span> из {requiredPhotos} фото выбрано
          <label htmlFor="file-upload-bottom" className="ml-4">
            <Button variant="outline" size="sm" className="ml-2" asChild>
              <span>
                <Icon name="Upload" size={16} className="mr-2" />
                Загрузить еще
              </span>
            </Button>
          </label>
          <input
            id="file-upload-bottom"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground mr-2">
            Можно загрузить еще: <span className="font-semibold">500 файлов</span>
          </p>
          <Button
            size="lg"
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            onClick={handleContinue}
            disabled={selectedPhotos.size === 0}
          >
            Выбрать
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PhotobookUploadStep;