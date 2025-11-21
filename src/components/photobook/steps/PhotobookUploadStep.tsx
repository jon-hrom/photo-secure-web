import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import type { UploadedPhoto } from '../PhotobookCreator';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface PhotoBankPhoto {
  id: number;
  file_name: string;
  s3_url?: string;
  data_url?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

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
  const [newUploadsCount, setNewUploadsCount] = useState(0);
  const [todayUploadsCount, setTodayUploadsCount] = useState(0);
  const [photoBankFolders, setPhotoBankFolders] = useState<PhotoFolder[]>([]);
  const [photoBankPhotos, setPhotoBankPhotos] = useState<PhotoBankPhoto[]>([]);
  const [selectedPhotoBankFolder, setSelectedPhotoBankFolder] = useState<PhotoFolder | null>(null);
  const [loadingPhotoBank, setLoadingPhotoBank] = useState(false);
  const [photoBankSelectedPhotos, setPhotoBankSelectedPhotos] = useState<Set<number>>(new Set());
  
  const unselectedCount = uploadedPhotos.length - selectedPhotos.size;
  
  const getAuthUserId = (): string | null => {
    const authSession = localStorage.getItem('authSession');
    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        if (session.userId) return session.userId.toString();
      } catch {}
    }
    
    const vkUser = localStorage.getItem('vk_user');
    if (vkUser) {
      try {
        const userData = JSON.parse(vkUser);
        if (userData.user_id) return userData.user_id.toString();
        if (userData.vk_id) return userData.vk_id.toString();
      } catch {}
    }
    
    return null;
  };
  
  const userId = getAuthUserId();
  const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';

  useEffect(() => {
    const savedPhotos = localStorage.getItem('photobank_selected_photos');
    if (savedPhotos) {
      try {
        const photos = JSON.parse(savedPhotos);
        const converted = photos.map((p: any) => ({
          id: `photobank-${p.id}`,
          url: p.url,
          file: new File([], p.file_name),
          width: p.width || 0,
          height: p.height || 0
        }));
        setUploadedPhotos(converted);
        localStorage.removeItem('photobank_selected_photos');
      } catch (error) {
        console.error('Failed to load photos from photobank:', error);
      }
    }
  }, []);
  
  useEffect(() => {
    if (userId) {
      fetchPhotoBankFolders();
    }
  }, [userId]);
  
  const fetchPhotoBankFolders = async () => {
    if (!userId) return;
    
    setLoadingPhotoBank(true);
    try {
      const res = await fetch(`${PHOTOBANK_FOLDERS_API}?action=list`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setPhotoBankFolders(data.folders || []);
    } catch (error) {
      console.error('Failed to load photobank folders:', error);
    } finally {
      setLoadingPhotoBank(false);
    }
  };
  
  const fetchPhotoBankPhotos = async (folderId: number) => {
    if (!userId) return;
    
    setLoadingPhotoBank(true);
    try {
      const res = await fetch(`${PHOTOBANK_FOLDERS_API}?action=list_photos&folder_id=${folderId}`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setPhotoBankPhotos(data.photos || []);
    } catch (error) {
      console.error('Failed to load photobank photos:', error);
    } finally {
      setLoadingPhotoBank(false);
    }
  };
  
  const togglePhotoBankPhotoSelection = (photoId: number) => {
    setPhotoBankSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };
  
  const addPhotoBankPhotosToSelection = () => {
    const selected = photoBankPhotos.filter(p => photoBankSelectedPhotos.has(p.id));
    const converted = selected.map(p => ({
      id: `photobank-${p.id}`,
      url: p.s3_url || p.data_url || '',
      file: new File([], p.file_name),
      width: p.width || 0,
      height: p.height || 0
    }));
    setUploadedPhotos(prev => [...prev, ...converted]);
    setPhotoBankSelectedPhotos(new Set());
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    const newFilesCount = files.length;
    setNewUploadsCount(prev => prev + newFilesCount);
    setTodayUploadsCount(prev => prev + newFilesCount);

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
            <TabsTrigger value="my-files" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none text-black">
              <Icon name="Folder" size={18} className="mr-2" />
              Мои файлы
            </TabsTrigger>
            <TabsTrigger value="photobank" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none text-black">
              <Icon name="Database" size={18} className="mr-2" />
              Фотобанк
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="my-files" className="flex-1 flex flex-col m-0">
          <div className="grid grid-cols-[250px_1fr] flex-1 overflow-hidden">
            <div className="border-r p-4 overflow-y-auto">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Дата загрузки файлов</h3>
                <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
                  <span className="text-sm">Все мои файлы</span>
                  <span className="text-xs text-muted-foreground">{uploadedPhotos.length}</span>
                </div>
                <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
                  <span className="text-sm">Новые загрузки</span>
                  <span className="text-xs text-muted-foreground">{newUploadsCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
                  <span className="text-sm">Загруженные сегодня</span>
                  <span className="text-xs text-muted-foreground">{todayUploadsCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
                  <span className="text-sm">Без альбома</span>
                  <span className="text-xs text-muted-foreground">{unselectedCount}</span>
                </div>
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
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white" asChild>
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

        <TabsContent value="photobank" className="flex-1 flex flex-col m-0">
          <div className="grid grid-cols-[250px_1fr] flex-1 overflow-hidden">
            <div className="border-r p-4 overflow-y-auto">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Папки</h3>
                {loadingPhotoBank ? (
                  <div className="text-center py-4">
                    <Icon name="Loader2" size={24} className="animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : photoBankFolders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Нет папок в фотобанке</p>
                ) : (
                  photoBankFolders.map(folder => (
                    <div
                      key={folder.id}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                        selectedPhotoBankFolder?.id === folder.id
                          ? 'bg-purple-100 text-purple-900'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        setSelectedPhotoBankFolder(folder);
                        fetchPhotoBankPhotos(folder.id);
                      }}
                    >
                      <span className="text-sm">{folder.folder_name}</span>
                      <span className="text-xs text-muted-foreground">{folder.photo_count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col overflow-hidden">
              {!selectedPhotoBankFolder ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Icon name="FolderOpen" size={64} className="mx-auto mb-4 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground">Выберите папку слева</p>
                  </div>
                </div>
              ) : loadingPhotoBank ? (
                <div className="flex-1 flex items-center justify-center">
                  <Icon name="Loader2" size={48} className="animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h3 className="font-semibold">{selectedPhotoBankFolder.folder_name}</h3>
                      {photoBankSelectedPhotos.size > 0 && (
                        <Button
                          onClick={addPhotoBankPhotosToSelection}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Icon name="Plus" size={16} className="mr-2" />
                          Добавить выбранные ({photoBankSelectedPhotos.size})
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const allIds = new Set(photoBankPhotos.map(p => p.id));
                        setPhotoBankSelectedPhotos(allIds);
                      }}
                      disabled={photoBankPhotos.length === 0}
                    >
                      <Icon name="CheckSquare" size={18} className="mr-2" />
                      Выделить все
                    </Button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4">
                    {photoBankPhotos.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <Icon name="ImageOff" size={64} className="mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground">В этой папке нет фотографий</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-4">
                        {photoBankPhotos.map(photo => (
                          <div
                            key={photo.id}
                            className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                              photoBankSelectedPhotos.has(photo.id)
                                ? 'border-purple-600 ring-4 ring-purple-200'
                                : 'border-transparent hover:border-purple-300'
                            }`}
                            onClick={() => togglePhotoBankPhotoSelection(photo.id)}
                          >
                            <img
                              src={photo.s3_url || photo.data_url || ''}
                              alt={photo.file_name}
                              className="w-full h-full object-cover"
                            />
                            {photoBankSelectedPhotos.has(photo.id) && (
                              <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1">
                                <Icon name="Check" size={16} className="text-white" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="text-white text-xs truncate">{photo.file_name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="border-t p-4 flex items-center justify-between bg-gray-50">
        <div className="text-sm">
          <span className="font-semibold">Выбрано: {selectedPhotos.size}</span>
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
          <Button
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
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