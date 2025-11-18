import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PHOTO_BANK_API = 'https://functions.poehali.dev/8aa39ae1-26f5-40c1-ad06-fe0d657f1310';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface Photo {
  id: number;
  file_name: string;
  s3_url: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

const PhotoBank = () => {
  const [folders, setFolders] = useState<PhotoFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<PhotoFolder | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [folderName, setFolderName] = useState('');
  const { toast } = useToast();

  const userId = localStorage.getItem('userId') || '1';

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${PHOTO_BANK_API}?action=list_folders`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setFolders(data.folders || []);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить папки',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async (folderId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${PHOTO_BANK_API}?action=list_photos&folder_id=${folderId}`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить фотографии',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      fetchPhotos(selectedFolder.id);
    }
  }, [selectedFolder]);

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название папки',
        variant: 'destructive'
      });
      return;
    }

    try {
      const res = await fetch(PHOTO_BANK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'create_folder',
          folder_name: folderName
        })
      });

      if (res.ok) {
        toast({
          title: 'Успешно',
          description: `Папка "${folderName}" создана`
        });
        setFolderName('');
        setShowCreateFolder(false);
        fetchFolders();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать папку',
        variant: 'destructive'
      });
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFolder) {
      toast({
        title: 'Ошибка',
        description: 'Выберите папку для загрузки',
        variant: 'destructive'
      });
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ошибка',
        description: 'Можно загружать только изображения',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const img = new Image();
        img.src = reader.result as string;
        await new Promise((resolve) => { img.onload = resolve; });

        const res = await fetch(PHOTO_BANK_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          },
          body: JSON.stringify({
            action: 'upload_photo',
            folder_id: selectedFolder.id,
            file_name: file.name,
            file_data: base64Data,
            width: img.width,
            height: img.height
          })
        });

        if (res.ok) {
          toast({
            title: 'Успешно',
            description: `Фото ${file.name} загружено`
          });
          fetchPhotos(selectedFolder.id);
          fetchFolders();
        } else {
          const error = await res.json();
          throw new Error(error.error || 'Ошибка загрузки');
        }
      };
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message || 'Не удалось загрузить фото',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: number, fileName: string) => {
    if (!confirm(`Удалить фото ${fileName}?`)) return;

    try {
      await fetch(PHOTO_BANK_API, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'delete_photo',
          photo_id: photoId
        })
      });

      toast({
        title: 'Успешно',
        description: `Фото ${fileName} удалено`
      });

      if (selectedFolder) {
        fetchPhotos(selectedFolder.id);
        fetchFolders();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить фото',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteFolder = async (folderId: number, folderName: string) => {
    if (!confirm(`Удалить папку "${folderName}" со всеми фотографиями?`)) return;

    try {
      await fetch(PHOTO_BANK_API, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'delete_folder',
          folder_id: folderId
        })
      });

      toast({
        title: 'Успешно',
        description: `Папка "${folderName}" удалена`
      });

      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null);
        setPhotos([]);
      }
      fetchFolders();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить папку',
        variant: 'destructive'
      });
    }
  };

  const handleClearAll = async () => {
    try {
      await fetch(PHOTO_BANK_API, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'clear_all'
        })
      });

      toast({
        title: 'Успешно',
        description: 'Весь фото банк очищен'
      });

      setSelectedFolder(null);
      setPhotos([]);
      setShowClearConfirm(false);
      fetchFolders();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось очистить банк',
        variant: 'destructive'
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать папку</DialogTitle>
            <DialogDescription>
              Введите название для новой папки с фотографиями
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Например: Отпуск 2025"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateFolder}>
              <Icon name="FolderPlus" size={16} className="mr-2" />
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Icon name="AlertTriangle" size={24} />
              Очистить весь банк?
            </DialogTitle>
            <DialogDescription>
              Это действие удалит ВСЕ папки и фотографии из вашего фото банка безвозвратно. Это нельзя отменить!
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <Icon name="AlertCircle" size={16} />
            <AlertDescription>
              Будут удалены: {folders.length} {folders.length === 1 ? 'папка' : 'папок'} и все фотографии внутри
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleClearAll}>
              <Icon name="Trash2" size={16} className="mr-2" />
              Да, очистить всё
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Мой фото банк</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowCreateFolder(true)}
            >
              <Icon name="FolderPlus" className="mr-2" size={18} />
              Новая папка
            </Button>
            {folders.length > 0 && (
              <Button 
                variant="destructive"
                onClick={() => setShowClearConfirm(true)}
              >
                <Icon name="Trash2" className="mr-2" size={18} />
                Очистить весь банк
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Folder" size={20} />
                Папки ({folders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && folders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="Loader2" size={32} className="animate-spin mx-auto mb-2" />
                  Загрузка...
                </div>
              ) : folders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="FolderOpen" size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Нет папок</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowCreateFolder(true)}
                    className="mt-2"
                  >
                    Создать первую папку
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedFolder?.id === folder.id
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:border-muted-foreground/20 hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedFolder(folder)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon name="Folder" size={16} className="text-primary shrink-0" />
                            <p className="font-medium text-sm truncate">{folder.folder_name}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-xs">
                              {folder.photo_count || 0} фото
                            </Badge>
                            <span className="truncate">{formatDate(folder.created_at)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id, folder.folder_name);
                          }}
                        >
                          <Icon name="Trash2" size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Image" size={20} />
                  {selectedFolder ? selectedFolder.folder_name : 'Фотографии'}
                </CardTitle>
                {selectedFolder && (
                  <div className="relative">
                    <input
                      type="file"
                      id="photo-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleUploadPhoto}
                      disabled={uploading}
                    />
                    <Button asChild disabled={uploading} size="sm">
                      <label htmlFor="photo-upload" className="cursor-pointer">
                        <Icon name="Upload" className="mr-2" size={16} />
                        {uploading ? 'Загрузка...' : 'Загрузить фото'}
                      </label>
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedFolder ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Icon name="FolderOpen" size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">Выберите папку</p>
                  <p className="text-sm">Выберите папку слева, чтобы просмотреть фотографии</p>
                </div>
              ) : loading ? (
                <div className="text-center py-16">
                  <Icon name="Loader2" size={48} className="animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Загрузка фотографий...</p>
                </div>
              ) : photos.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Icon name="ImageOff" size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">Нет фотографий</p>
                  <p className="text-sm mb-4">Загрузите первое фото в эту папку</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square rounded-lg overflow-hidden border-2 border-muted hover:border-primary transition-all"
                    >
                      <img
                        src={photo.s3_url}
                        alt={photo.file_name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                        <Button
                          variant="destructive"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeletePhoto(photo.id, photo.file_name)}
                        >
                          <Icon name="Trash2" size={18} />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs truncate">{photo.file_name}</p>
                        <p className="text-white/70 text-xs">
                          {formatBytes(photo.file_size)}
                          {photo.width && photo.height && ` • ${photo.width}×${photo.height}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PhotoBank;
