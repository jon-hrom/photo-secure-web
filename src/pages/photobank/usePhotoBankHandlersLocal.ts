import { useNavigate } from 'react-router-dom';

interface UsePhotoBankHandlersLocalProps {
  userId: string;
  selectedFolder: any;
  selectedPhotos: Set<number>;
  photos: any[];
  setShareModalFolder: (value: { id: number; name: string } | null) => void;
  setFolderChatsId: (value: number | null) => void;
  setSelectedFolder: (value: any) => void;
  setLoading: (value: boolean) => void;
  setSelectedPhotos: (value: Set<number>) => void;
  setSelectionMode: (value: boolean) => void;
  handleDeletePhoto: (photoId: number, fileName: string) => Promise<void>;
  handleRestorePhoto: (photoId: number) => Promise<any>;
  fetchFolders: () => Promise<void>;
  fetchPhotos: (folderId: number) => Promise<void>;
}

export const usePhotoBankHandlersLocal = ({
  userId,
  selectedFolder,
  selectedPhotos,
  photos,
  setShareModalFolder,
  setFolderChatsId,
  setSelectedFolder,
  setLoading,
  setSelectedPhotos,
  setSelectionMode,
  handleDeletePhoto,
  handleRestorePhoto,
  fetchFolders,
  fetchPhotos,
}: UsePhotoBankHandlersLocalProps) => {
  const navigate = useNavigate();

  const handleExitAdminView = () => {
    localStorage.removeItem('admin_viewing_user_id');
    const adminViewingUser = localStorage.getItem('admin_viewing_user');
    if (adminViewingUser) {
      navigate('/');
    } else {
      navigate('/');
    }
  };

  const handleDeleteSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) return;

    const confirmed = window.confirm(
      `Удалить выбранные фото (${selectedPhotos.size}) в корзину?`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      for (const photoId of selectedPhotos) {
        const photo = photos.find(p => p.id === photoId);
        if (photo) {
          await handleDeletePhoto(photoId, photo.file_name);
        }
      }
      setSelectedPhotos(new Set());
      setSelectionMode(false);
      if (selectedFolder) {
        await fetchPhotos(selectedFolder.id);
      }
      await fetchFolders();
    } catch (error) {
      console.error('Failed to delete photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShareFolder = async (folderId: number, folderName: string) => {
    setShareModalFolder({ id: folderId, name: folderName });
  };

  const handleOpenFolderChats = (folderId: number) => {
    setFolderChatsId(folderId);
  };

  const handleRenameFolder = () => {
    if (!selectedFolder) return;
    const newName = window.prompt('Введите новое название папки:', selectedFolder.folder_name);
    if (!newName || newName.trim() === '' || newName === selectedFolder.folder_name) return;

    const PHOTO_BANK_API = 'https://functions.poehali.dev/8aa39ae1-26f5-40c1-ad06-fe0d657f1310';
    
    fetch(PHOTO_BANK_API, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: JSON.stringify({ 
        action: 'rename_folder',
        folder_id: selectedFolder.id,
        folder_name: newName.trim() 
      })
    })
      .then(res => res.json())
      .then(() => {
        fetchFolders();
        setSelectedFolder({ ...selectedFolder, folder_name: newName.trim() });
      })
      .catch(err => {
        console.error('Failed to rename folder:', err);
        alert('Ошибка переименования папки');
      });
  };

  const handleRestoreSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) return;

    const confirmed = window.confirm(
      `Вернуть выбранные фото (${selectedPhotos.size}) обратно в оригиналы?`
    );

    if (!confirmed) return;

    setLoading(true);
    let restoredCount = 0;
    let cleanedCount = 0;

    try {
      for (const photoId of selectedPhotos) {
        try {
          const result = await handleRestorePhoto(photoId);
          if (result?.cleaned) {
            cleanedCount++;
          } else {
            restoredCount++;
          }
        } catch (error) {
          console.error(`Failed to restore photo ${photoId}:`, error);
        }
      }

      setSelectedPhotos(new Set());
      setSelectionMode(false);
      
      if (selectedFolder) {
        await fetchPhotos(selectedFolder.id);
      }
      await fetchFolders();

      const message = cleanedCount > 0 
        ? `Восстановлено: ${restoredCount}, удалено из базы (файл отсутствует): ${cleanedCount}`
        : `Успешно восстановлено ${restoredCount} фото`;
      
      alert(message);
    } catch (error) {
      console.error('Failed to restore photos:', error);
      alert('Произошла ошибка при восстановлении фото');
    } finally {
      setLoading(false);
    }
  };

  return {
    handleExitAdminView,
    handleDeleteSelectedPhotos,
    handleShareFolder,
    handleOpenFolderChats,
    handleRenameFolder,
    handleRestoreSelectedPhotos,
  };
};
