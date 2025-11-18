import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import PhotoBankDialogs from '@/components/photobank/PhotoBankDialogs';

const PHOTO_BANK_API = 'https://functions.poehali.dev/8aa39ae1-26f5-40c1-ad06-fe0d657f1310';
const STORAGE_API = 'https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985';

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
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ usedGb: 0, limitGb: 5, percent: 0 });
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

  const fetchStorageUsage = async () => {
    try {
      const res = await fetch(`${STORAGE_API}?action=usage`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setStorageUsage({
        usedGb: data.usedGb || 0,
        limitGb: data.limitGb || 5,
        percent: data.percent || 0
      });
    } catch (error) {
      console.error('Failed to fetch storage usage:', error);
    }
  };

  useEffect(() => {
    fetchFolders();
    fetchStorageUsage();
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

  const togglePhotoSelection = (photoId: number) => {
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

  const handleAddToPhotobook = () => {
    if (selectedPhotos.size === 0) {
      toast({
        title: 'Выберите фото',
        description: 'Отметьте фотографии для добавления в макет',
        variant: 'destructive'
      });
      return;
    }

    const selected = photos.filter(p => selectedPhotos.has(p.id));
    localStorage.setItem('photobank_selected_photos', JSON.stringify(selected.map(p => ({
      id: p.id,
      url: p.s3_url,
      width: p.width,
      height: p.height,
      file_name: p.file_name
    }))));

    toast({
      title: 'Успешно',
      description: `${selectedPhotos.size} фото добавлены в макет`
    });

    setSelectedPhotos(new Set());
    setSelectionMode(false);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <PhotoBankDialogs
        showCreateFolder={showCreateFolder}
        showClearConfirm={showClearConfirm}
        folderName={folderName}
        foldersCount={folders.length}
        onSetShowCreateFolder={setShowCreateFolder}
        onSetShowClearConfirm={setShowClearConfirm}
        onSetFolderName={setFolderName}
        onCreateFolder={handleCreateFolder}
        onClearAll={handleClearAll}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        <PhotoBankStorageIndicator storageUsage={storageUsage} />

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Мой фото банк</h1>
          <div className="flex gap-2">
            {selectionMode && (
              <>
                <Button 
                  variant="default"
                  onClick={handleAddToPhotobook}
                  disabled={selectedPhotos.size === 0}
                >
                  <Icon name="Plus" className="mr-2" size={18} />
                  Добавить в макет ({selectedPhotos.size})
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedPhotos(new Set());
                  }}
                >
                  Отмена
                </Button>
              </>
            )}
            {!selectionMode && selectedFolder && photos.length > 0 && (
              <Button 
                variant="outline"
                onClick={() => setSelectionMode(true)}
              >
                <Icon name="CheckSquare" className="mr-2" size={18} />
                Выбрать фото
              </Button>
            )}
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
          <PhotoBankFoldersList
            folders={folders}
            selectedFolder={selectedFolder}
            loading={loading}
            onSelectFolder={setSelectedFolder}
            onDeleteFolder={handleDeleteFolder}
            onCreateFolder={() => setShowCreateFolder(true)}
          />

          <PhotoBankPhotoGrid
            selectedFolder={selectedFolder}
            photos={photos}
            loading={loading}
            uploading={uploading}
            selectionMode={selectionMode}
            selectedPhotos={selectedPhotos}
            onUploadPhoto={handleUploadPhoto}
            onDeletePhoto={handleDeletePhoto}
            onTogglePhotoSelection={togglePhotoSelection}
          />
        </div>
      </div>
    </div>
  );
};

export default PhotoBank;
