import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import funcUrls from '../../../backend/func2url.json';
import PhotoGridViewer from '@/components/photobank/PhotoGridViewer';

interface PhotoFolder {
  id: number;
  folder_name: string;
  s3_prefix: string;
  folder_type: string;
  parent_folder_id: number | null;
  created_at: string;
  updated_at: string;
  photo_count: number;
  archive_download_count: number;
  is_hidden: boolean;
  has_password: boolean;
  sort_order: number;
}

interface Photo {
  id: number;
  file_name: string;
  s3_key: string;
  s3_url: string;
  thumbnail_s3_key: string;
  thumbnail_s3_url: string;
  is_raw: boolean;
  is_video: boolean;
  content_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  tech_reject_reason: string | null;
  tech_analyzed: boolean;
  created_at: string;
  photo_download_count: number;
}

interface AdminUserPhotoBankProps {
  userId: string | number;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

const API_URL = (funcUrls as Record<string, string>)['admin-user-photobank'];

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const AdminUserPhotoBank = ({ userId, userName, isOpen, onClose }: AdminUserPhotoBankProps) => {
  const [folders, setFolders] = useState<PhotoFolder[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<PhotoFolder | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const realUserId = String(userId).replace('vk_', '');

  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch(`${API_URL}?action=folders&user_id=${realUserId}`);
      const data = await res.json();
      setFolders(data.folders || []);
    } catch (e) {
      console.error('Failed to fetch folders:', e);
    } finally {
      setLoadingFolders(false);
    }
  }, [realUserId]);

  const fetchPhotos = useCallback(async (folderId: number) => {
    setLoadingPhotos(true);
    try {
      const res = await fetch(`${API_URL}?action=photos&user_id=${realUserId}&folder_id=${folderId}`);
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (e) {
      console.error('Failed to fetch photos:', e);
    } finally {
      setLoadingPhotos(false);
    }
  }, [realUserId]);

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      setSelectedFolder(null);
      setPhotos([]);
      setSelectedPhotos(new Set());
    }
  }, [isOpen, fetchFolders]);

  const handleSelectFolder = (folder: PhotoFolder) => {
    setSelectedFolder(folder);
    setSelectedPhotos(new Set());
    fetchPhotos(folder.id);
  };

  const handleBack = () => {
    setSelectedFolder(null);
    setPhotos([]);
    setSelectedPhotos(new Set());
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!viewPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === viewPhoto.id);
    if (currentIndex === -1) return;
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < photos.length) {
      setViewPhoto(photos[newIndex]);
    }
  };

  const handleDownload = async (s3Key: string, fileName: string, _userId: number) => {
    const photo = photos.find(p => p.s3_key === s3Key);
    if (!photo?.s3_url) return;
    const link = document.createElement('a');
    link.href = photo.s3_url;
    link.download = fileName;
    link.target = '_blank';
    link.click();
  };

  const handleDeleteFolder = async (folder: PhotoFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Удалить папку «${folder.folder_name}» и все фото внутри?\n\nФайлы будут перемещены в корзину.`)) return;
    
    setDeleting(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_folder', user_id: realUserId, folder_id: folder.id })
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Папка «${folder.folder_name}» удалена (${data.moved_files} файлов в корзине)`);
        fetchFolders();
      } else {
        toast.error(data.error || 'Ошибка удаления');
      }
    } catch (e) {
      toast.error('Ошибка сети');
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) return;
    if (!confirm(`Удалить ${selectedPhotos.size} фото?\n\nФайлы будут перемещены в корзину.`)) return;
    
    setDeleting(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'delete_photos', 
          user_id: realUserId, 
          photo_ids: Array.from(selectedPhotos)
        })
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Удалено ${data.deleted_count} фото`);
        setSelectedPhotos(new Set());
        if (selectedFolder) fetchPhotos(selectedFolder.id);
        fetchFolders();
      } else {
        toast.error(data.error || 'Ошибка удаления');
      }
    } catch (e) {
      toast.error('Ошибка сети');
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const togglePhotoSelection = (photoId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const mainFolders = folders.filter(f => !f.parent_folder_id);
  const getSubfolders = (parentId: number) => folders.filter(f => f.parent_folder_id === parentId);
  const totalPhotos = folders.reduce((sum, f) => sum + (f.photo_count || 0), 0);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] overflow-hidden p-0">
          <VisuallyHidden>
            <DialogTitle>Фотобанк пользователя {userName}</DialogTitle>
          </VisuallyHidden>

          <div className="flex flex-col h-full max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
              <div className="flex items-center gap-3 min-w-0">
                {selectedFolder && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack}>
                    <Icon name="ArrowLeft" size={18} />
                  </Button>
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {selectedFolder ? selectedFolder.folder_name : `Фотобанк — ${userName}`}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedFolder
                      ? `${photos.length} фото • S3: ${selectedFolder.s3_prefix || '—'}`
                      : `${folders.length} папок • ${totalPhotos} фото`
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedFolder && photos.length > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={toggleSelectAll}
                    >
                      <Checkbox checked={selectedPhotos.size === photos.length && photos.length > 0} className="h-3.5 w-3.5" />
                      Все
                    </Button>
                    {selectedPhotos.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={handleDeleteSelectedPhotos}
                        disabled={deleting}
                      >
                        {deleting ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Trash2" size={14} />}
                        Удалить ({selectedPhotos.size})
                      </Button>
                    )}
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
                  <Icon name="X" size={18} />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {!selectedFolder ? (
                <>
                  {loadingFolders ? (
                    <div className="flex items-center justify-center py-12">
                      <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : folders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Icon name="FolderOpen" size={48} className="mx-auto mb-3 opacity-50" />
                      <p className="text-sm">У пользователя нет папок</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {mainFolders.map((folder) => {
                        const subfolders = getSubfolders(folder.id);
                        return (
                          <div key={folder.id}>
                            <FolderRow 
                              folder={folder} 
                              onClick={() => handleSelectFolder(folder)} 
                              onDelete={(e) => handleDeleteFolder(folder, e)}
                              formatDate={formatDate}
                              deleting={deleting}
                            />
                            {subfolders.length > 0 && (
                              <div className="ml-6 border-l-2 border-muted pl-2 space-y-1 mt-1">
                                {subfolders.map(sub => (
                                  <FolderRow 
                                    key={sub.id} 
                                    folder={sub} 
                                    onClick={() => handleSelectFolder(sub)} 
                                    onDelete={(e) => handleDeleteFolder(sub, e)}
                                    formatDate={formatDate}
                                    deleting={deleting}
                                    isSubfolder 
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {loadingPhotos ? (
                    <div className="flex items-center justify-center py-12">
                      <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : photos.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Icon name="Image" size={48} className="mx-auto mb-3 opacity-50" />
                      <p className="text-sm">В папке нет фото</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
                      {photos.map((photo) => {
                        const isSelected = selectedPhotos.has(photo.id);
                        return (
                          <div
                            key={photo.id}
                            className={`relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer group transition-all ${
                              isSelected ? 'ring-2 ring-red-500' : 'hover:ring-2 hover:ring-primary/50'
                            }`}
                            onClick={() => setViewPhoto(photo)}
                          >
                            {photo.is_video ? (
                              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                <Icon name="Play" size={32} className="text-white/70" />
                              </div>
                            ) : (
                              <img
                                src={photo.thumbnail_s3_url || photo.s3_url || ''}
                                alt={photo.file_name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[10px] text-white truncate">{photo.file_name}</p>
                              <p className="text-[9px] text-white/70">{formatBytes(photo.file_size)}</p>
                            </div>
                            {photo.is_raw && (
                              <span className="absolute top-1 right-1 text-[9px] bg-orange-500 text-white px-1 rounded">RAW</span>
                            )}
                            {photo.tech_reject_reason && (
                              <span className="absolute top-1 left-7">
                                <Icon name="AlertTriangle" size={14} className="text-red-500 drop-shadow" />
                              </span>
                            )}
                            <div
                              className={`absolute top-1 left-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                              onClick={(e) => togglePhotoSelection(photo.id, e)}
                            >
                              <Checkbox 
                                checked={isSelected} 
                                className="h-5 w-5 bg-white/80 border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {viewPhoto && (
        <PhotoGridViewer
          viewPhoto={viewPhoto}
          photos={photos}
          onClose={() => setViewPhoto(null)}
          onNavigate={handleNavigate}
          onDownload={handleDownload}
          formatBytes={formatBytes}
          downloadDisabled={false}
        />
      )}
    </>
  );
};

interface FolderRowProps {
  folder: PhotoFolder;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatDate: (date: string) => string;
  deleting: boolean;
  isSubfolder?: boolean;
}

const FolderRow = ({ folder, onClick, onDelete, formatDate, deleting, isSubfolder }: FolderRowProps) => {
  const folderTypeLabel: Record<string, { text: string; color: string }> = {
    'originals': { text: 'Оригиналы', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    'tech_rejects': { text: 'Тех. брак', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
    'retouch': { text: 'Ретушь', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  };

  const typeInfo = folder.folder_type ? folderTypeLabel[folder.folder_type] : null;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border group"
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
        isSubfolder ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-orange-100 dark:bg-orange-950/50'
      }`}>
        <Icon name={isSubfolder ? 'FolderOpen' : 'Folder'} size={20} className={isSubfolder ? 'text-blue-600' : 'text-orange-600'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{folder.folder_name}</span>
          {typeInfo && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeInfo.color}`}>{typeInfo.text}</span>
          )}
          {folder.is_hidden && (
            <Icon name="EyeOff" size={12} className="text-muted-foreground" />
          )}
          {folder.has_password && (
            <Icon name="Lock" size={12} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Icon name="Image" size={12} />
            {folder.photo_count || 0}
          </span>
          <span>{formatDate(folder.created_at)}</span>
          {folder.s3_prefix && (
            <span className="text-[10px] font-mono opacity-60 truncate max-w-[200px]" title={folder.s3_prefix}>
              {folder.s3_prefix}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(folder.archive_download_count ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Icon name="Download" size={14} />
            {folder.archive_download_count}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
          onClick={onDelete}
          disabled={deleting}
          title="Удалить папку"
        >
          {deleting ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Trash2" size={14} />}
        </Button>
        <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
      </div>
    </div>
  );
};

export default AdminUserPhotoBank;
