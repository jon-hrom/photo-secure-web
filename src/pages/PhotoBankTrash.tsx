import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import TrashHeader from '@/components/photobank-trash/TrashHeader';
import TrashedFoldersList from '@/components/photobank-trash/TrashedFoldersList';
import TrashedPhotosGrid from '@/components/photobank-trash/TrashedPhotosGrid';
import { getAuthUserId, formatDate, getDaysLeftBadge, getDaysLeft } from '@/components/photobank-trash/utils';
import { useTrashApi } from '@/components/photobank-trash/useTrashApi';

const PhotoBankTrash = () => {
  const navigate = useNavigate();
  const userId = getAuthUserId();
  const [authChecking, setAuthChecking] = useState(true);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [filterCritical, setFilterCritical] = useState(false);

  const {
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
  } = useTrashApi(userId);

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

  const onBulkRestore = async () => {
    await handleBulkRestore(selectedPhotoIds);
    setSelectedPhotoIds(new Set());
    setSelectionMode(false);
  };

  const onBulkDelete = async () => {
    await handleBulkDelete(selectedPhotoIds);
    setSelectedPhotoIds(new Set());
    setSelectionMode(false);
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
          onBulkRestore={onBulkRestore}
          onBulkDelete={onBulkDelete}
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
