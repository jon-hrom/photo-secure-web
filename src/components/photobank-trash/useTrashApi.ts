import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TrashedFolder, TrashedPhoto } from './types';

const PHOTOBANK_TRASH_API = 'https://functions.poehali.dev/d2679e28-52e9-417d-86d7-f508a013bf7d';

export const useTrashApi = (userId: string | null) => {
  const { toast } = useToast();
  const [trashedFolders, setTrashedFolders] = useState<TrashedFolder[]>([]);
  const [trashedPhotos, setTrashedPhotos] = useState<TrashedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchTrash = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const [foldersRes, photosRes] = await Promise.all([
        fetch(`${PHOTOBANK_TRASH_API}?action=list`, {
          headers: { 'X-User-Id': userId }
        }),
        fetch(`${PHOTOBANK_TRASH_API}?action=list_photos`, {
          headers: { 'X-User-Id': userId }
        })
      ]);
      
      const foldersData = await foldersRes.json();
      const photosData = await photosRes.json();
      
      setTrashedFolders(foldersData.trashed_folders || []);
      setTrashedPhotos(photosData.trashed_photos || []);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить корзину',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (folderId: number, folderName: string) => {
    if (!userId) return;
    if (!confirm(`Восстановить папку "${folderName}"?`)) return;
    
    setRestoring(folderId);
    try {
      const res = await fetch(PHOTOBANK_TRASH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'restore',
          folder_id: folderId
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to restore folder');
      }
      
      toast({
        title: 'Успешно',
        description: `Папка "${folderName}" восстановлена`
      });
      
      fetchTrash();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось восстановить папку',
        variant: 'destructive'
      });
    } finally {
      setRestoring(null);
    }
  };

  const handleRestorePhoto = async (photoId: number, fileName: string) => {
    if (!userId) return;
    if (!confirm(`Восстановить фото "${fileName}"?`)) return;
    
    setRestoring(photoId);
    try {
      const res = await fetch(PHOTOBANK_TRASH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'restore_photo',
          photo_id: photoId
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to restore photo');
      }
      
      toast({
        title: 'Успешно',
        description: `Фото "${fileName}" восстановлено`
      });
      
      fetchTrash();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось восстановить фото',
        variant: 'destructive'
      });
    } finally {
      setRestoring(null);
    }
  };

  const handleDeletePhotoForever = async (photoId: number, fileName: string) => {
    if (!userId) return;
    if (!confirm(`Удалить фото "${fileName}" навсегда? Это действие нельзя отменить!`)) return;
    
    setDeleting(photoId);
    try {
      const res = await fetch(PHOTOBANK_TRASH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'delete_photo_forever',
          photo_id: photoId
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete photo');
      }
      
      toast({
        title: 'Успешно',
        description: `Фото "${fileName}" удалено навсегда`
      });
      
      fetchTrash();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить фото',
        variant: 'destructive'
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkRestore = async (selectedPhotoIds: Set<number>) => {
    if (!userId || selectedPhotoIds.size === 0) return;
    if (!confirm(`Восстановить ${selectedPhotoIds.size} фото?`)) return;
    
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const photoId of selectedPhotoIds) {
      try {
        const res = await fetch(PHOTOBANK_TRASH_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          },
          body: JSON.stringify({
            action: 'restore_photo',
            photo_id: photoId
          })
        });
        
        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }
    
    toast({
      title: 'Готово',
      description: `Восстановлено: ${successCount}${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`
    });
    
    setLoading(false);
    fetchTrash();
  };

  const handleBulkDelete = async (selectedPhotoIds: Set<number>) => {
    if (!userId || selectedPhotoIds.size === 0) return;
    if (!confirm(`Удалить ${selectedPhotoIds.size} фото навсегда? Это действие нельзя отменить!`)) return;
    
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const photoId of selectedPhotoIds) {
      try {
        const res = await fetch(PHOTOBANK_TRASH_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          },
          body: JSON.stringify({
            action: 'delete_photo_forever',
            photo_id: photoId
          })
        });
        
        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }
    
    toast({
      title: 'Готово',
      description: `Удалено: ${successCount}${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`
    });
    
    setLoading(false);
    fetchTrash();
  };

  const handleEmptyTrash = async () => {
    if (!userId) return;
    if (!confirm('Очистить корзину полностью? Это действие нельзя отменить!')) return;
    
    setLoading(true);
    try {
      const res = await fetch(PHOTOBANK_TRASH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'empty'
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to empty trash');
      }
      
      const result = await res.json();
      
      toast({
        title: 'Успешно',
        description: `Удалено ${result.deleted_folders} папок и ${result.deleted_files} файлов`
      });
      
      fetchTrash();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось очистить корзину',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    trashedFolders,
    trashedPhotos,
    loading,
    restoring,
    deleting,
    fetchTrash,
    handleRestore,
    handleRestorePhoto,
    handleDeletePhotoForever,
    handleBulkRestore,
    handleBulkDelete,
    handleEmptyTrash
  };
};
