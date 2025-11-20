import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

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
  const [authChecking, setAuthChecking] = useState(true);
  
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/photo-bank')}
            >
              <Icon name="ArrowLeft" size={24} />
            </Button>
            <h1 className="text-3xl font-bold">Корзина</h1>
          </div>
          {(trashedFolders.length > 0 || trashedPhotos.length > 0) && (
            <Button 
              variant="destructive"
              onClick={handleEmptyTrash}
              disabled={loading}
            >
              <Icon name="Trash2" className="mr-2" size={18} />
              Очистить корзину
            </Button>
          )}
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Trash2" size={20} />
              Удаленные папки ({trashedFolders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && trashedFolders.length === 0 && trashedPhotos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="Loader2" size={32} className="animate-spin mx-auto mb-2" />
                Загрузка...
              </div>
            ) : trashedFolders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="FolderOpen" size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет удаленных папок</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trashedFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="p-3 rounded-lg border-2 border-muted hover:border-muted-foreground/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name="Folder" size={16} className="text-muted-foreground shrink-0" />
                          <p className="font-medium text-sm truncate">{folder.folder_name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {folder.photo_count || 0} фото
                          </Badge>
                          <span className="truncate">{formatDate(folder.trashed_at)}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(folder.id, folder.folder_name)}
                        disabled={restoring === folder.id}
                      >
                        {restoring === folder.id ? (
                          <Icon name="Loader2" size={14} className="animate-spin mr-2" />
                        ) : (
                          <Icon name="Undo2" size={14} className="mr-2" />
                        )}
                        Восстановить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {trashedPhotos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Image" size={20} />
                Удаленные фото ({trashedPhotos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {trashedPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group rounded-lg overflow-hidden border-2 border-muted hover:border-muted-foreground/20 transition-colors"
                  >
                    <div className="aspect-square bg-muted">
                      {photo.s3_url ? (
                        <img
                          src={photo.s3_url}
                          alt={photo.file_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="ImageOff" size={32} className="text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRestorePhoto(photo.id, photo.file_name)}
                        disabled={restoring === photo.id}
                      >
                        {restoring === photo.id ? (
                          <Icon name="Loader2" size={14} className="animate-spin" />
                        ) : (
                          <>
                            <Icon name="Undo2" size={14} className="mr-1" />
                            Восстановить
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white truncate">{photo.file_name}</p>
                      <p className="text-[10px] text-white/70">{formatDate(photo.trashed_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
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