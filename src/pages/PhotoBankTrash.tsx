import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import TrashHeader from '@/components/photobank-trash/TrashHeader';
import TrashedFoldersList from '@/components/photobank-trash/TrashedFoldersList';
import TrashedPhotosGrid from '@/components/photobank-trash/TrashedPhotosGrid';

interface TrashedFolder {
  id: number;
  folder_name: string;
  s3_prefix: string;
  trashed_at: string;
  photo_count: number;
}

interface TrashedPhoto {
  id: number;
  file_name: string;
  s3_key: string;
  s3_url: string;
  file_size: number;
  width: number | null;
  height: number | null;
  trashed_at: string;
  folder_name: string;
}

const PhotoBankTrash = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
  
  const [trashedFolders, setTrashedFolders] = useState<TrashedFolder[]>([]);
  const [trashedPhotos, setTrashedPhotos] = useState<TrashedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [filterCritical, setFilterCritical] = useState(false);
  
  const PHOTOBANK_TRASH_API = 'https://functions.poehali.dev/d2679e28-52e9-417d-86d7-f508a013bf7d';

  useEffect(() => {
    const checkAuth = () => {
      const authSession = localStorage.getItem('authSession');
      const vkUser = localStorage.getItem('vk_user');
      
      if (!authSession && !vkUser) {
        navigate('/login');
        return;
      }
      
      if (authSession) {
        try {
          const session = JSON.parse(authSession);
          if (!session.isAuthenticated || !session.userId) {
            navigate('/login');
            return;
          }
        } catch {
          navigate('/login');
          return;
        }
      }
      
      if (vkUser) {
        try {
          const userData = JSON.parse(vkUser);
          if (!userData.user_id && !userData.vk_id) {
            navigate('/login');
            return;
          }
        } catch {
          navigate('/login');
          return;
        }
      }
      
      setAuthChecking(false);
    };
    
    checkAuth();
  }, [navigate]);
  
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
  
  const handleBulkRestore = async () => {
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
    
    setSelectedPhotoIds(new Set());
    setSelectionMode(false);
    setLoading(false);
    fetchTrash();
  };
  
  const handleBulkDelete = async () => {
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
    
    setSelectedPhotoIds(new Set());
    setSelectionMode(false);
    setLoading(false);
    fetchTrash();
  };
  
  const togglePhotoSelection = (photoId: number) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };
  
  const selectAllPhotos = () => {
    setSelectedPhotoIds(new Set(filteredAndSortedPhotos.map(p => p.id)));
  };
  
  const deselectAllPhotos = () => {
    setSelectedPhotoIds(new Set());
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
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const daysLeft = 7 - days;
    
    if (daysLeft <= 0) return 'Удаляется...';
    if (daysLeft === 1) return '1 день до удаления';
    if (daysLeft <= 4) return `${daysLeft} дня до удаления`;
    return `${daysLeft} дней до удаления`;
  };
  
  const getDaysLeftBadge = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const daysLeft = 7 - days;
    
    return {
      days: daysLeft,
      variant: daysLeft <= 2 ? 'destructive' : daysLeft <= 4 ? 'default' : 'secondary',
      text: daysLeft <= 0 ? 'Удаление...' : `${daysLeft}д`
    };
  };
  
  const getDaysLeft = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return 7 - days;
  };
  
  const filteredAndSortedPhotos = trashedPhotos
    .filter(photo => {
      if (searchQuery && !photo.file_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterCritical && getDaysLeft(photo.trashed_at) > 2) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.trashed_at).getTime() - new Date(a.trashed_at).getTime();
      } else if (sortBy === 'name') {
        return a.file_name.localeCompare(b.file_name);
      } else if (sortBy === 'size') {
        return (b.file_size || 0) - (a.file_size || 0);
      }
      return 0;
    });

  useEffect(() => {
    if (!authChecking && userId) {
      fetchTrash();
    }
  }, [authChecking, userId]);
  
  if (authChecking || !userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Проверка авторизации...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <TrashHeader 
          hasFolders={trashedFolders.length > 0}
          hasPhotos={trashedPhotos.length > 0}
          loading={loading}
          onEmptyTrash={handleEmptyTrash}
        />
        
        <TrashedFoldersList
          folders={trashedFolders}
          loading={loading}
          restoring={restoring}
          onRestore={handleRestore}
          getDaysLeftBadge={getDaysLeftBadge}
          formatDate={formatDate}
        />
        
        <TrashedPhotosGrid
          photos={trashedPhotos}
          filteredAndSortedPhotos={filteredAndSortedPhotos}
          loading={loading}
          restoring={restoring}
          deleting={deleting}
          selectionMode={selectionMode}
          selectedPhotoIds={selectedPhotoIds}
          searchQuery={searchQuery}
          sortBy={sortBy}
          filterCritical={filterCritical}
          onRestorePhoto={handleRestorePhoto}
          onDeletePhotoForever={handleDeletePhotoForever}
          onBulkRestore={handleBulkRestore}
          onBulkDelete={handleBulkDelete}
          onToggleSelection={togglePhotoSelection}
          onSelectAll={selectAllPhotos}
          onDeselectAll={deselectAllPhotos}
          setSelectionMode={setSelectionMode}
          setSelectedPhotoIds={setSelectedPhotoIds}
          setSearchQuery={setSearchQuery}
          setSortBy={setSortBy}
          setFilterCritical={setFilterCritical}
          getDaysLeftBadge={getDaysLeftBadge}
          formatDate={formatDate}
        />
        
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Icon name="Info" size={20} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">О корзине</p>
                <p>Файлы в корзине автоматически удаляются через 7 дней.</p>
                <p className="mt-1">Вы можете восстановить папки и фото до истечения этого срока.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PhotoBankTrash;
