import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface S3Folder {
  name: string;
  prefix: string;
}

interface S3File {
  name: string;
  key: string;
  size: number;
  last_modified: string;
  storage_class: string;
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

  const [s3Folders, setS3Folders] = useState<S3Folder[]>([]);
  const [s3Files, setS3Files] = useState<S3File[]>([]);
  const [s3Prefix, setS3Prefix] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Loading, setS3Loading] = useState(false);
  const [s3History, setS3History] = useState<string[]>([]);
  const [s3ViewFile, setS3ViewFile] = useState<S3File | null>(null);
  const [s3ViewUrl, setS3ViewUrl] = useState('');
  const [s3ViewLoading, setS3ViewLoading] = useState(false);

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

  const fetchS3 = useCallback(async (prefix?: string) => {
    setS3Loading(true);
    try {
      const targetPrefix = prefix !== undefined ? prefix : `photobank/${realUserId}/`;
      const res = await fetch(`${API_URL}?action=s3_browse&user_id=${realUserId}&prefix=${encodeURIComponent(targetPrefix)}`);
      const data = await res.json();
      setS3Folders(data.folders || []);
      setS3Files(data.files || []);
      setS3Prefix(data.prefix || targetPrefix);
      setS3Bucket(data.bucket || '');
    } catch (e) {
      console.error('Failed to browse S3:', e);
    } finally {
      setS3Loading(false);
    }
  }, [realUserId]);

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      setSelectedFolder(null);
      setPhotos([]);
      setSelectedPhotos(new Set());
      setS3History([]);
    }
  }, [isOpen, fetchFolders]);

  useEffect(() => {
    if (!s3ViewFile) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setS3ViewFile(null); setS3ViewUrl(''); }
      else if (e.key === 'ArrowLeft') navigateS3File('prev');
      else if (e.key === 'ArrowRight') navigateS3File('next');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [s3ViewFile, s3Files]);

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
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPhotos.size === photos.length) setSelectedPhotos(new Set());
    else setSelectedPhotos(new Set(photos.map(p => p.id)));
  };

  const navigateS3 = (prefix: string) => {
    setS3History(prev => [...prev, s3Prefix]);
    fetchS3(prefix);
  };

  const navigateS3Back = () => {
    const prev = s3History[s3History.length - 1];
    if (prev !== undefined) {
      setS3History(h => h.slice(0, -1));
      fetchS3(prev);
    }
  };

  const isPreviewable = (name: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
  const isRawFile = (name: string) => /\.(raw|cr2|cr3|nef|arw|dng|orf|rw2|pef|raf|srw|heic|heif)$/i.test(name);
  const isVideoFile = (name: string) => /\.(mp4|mov|avi|webm|mkv)$/i.test(name);

  const openS3FileView = async (file: S3File) => {
    setS3ViewFile(file);
    setS3ViewUrl('');
    setS3ViewLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=s3_presign&user_id=${realUserId}&key=${encodeURIComponent(file.key)}`);
      const data = await res.json();
      if (data.url) setS3ViewUrl(data.url);
      else toast.error('Не удалось получить ссылку');
    } catch {
      toast.error('Ошибка сети');
    } finally {
      setS3ViewLoading(false);
    }
  };

  const navigateS3File = (direction: 'prev' | 'next') => {
    if (!s3ViewFile) return;
    const idx = s3Files.findIndex(f => f.key === s3ViewFile.key);
    const newIdx = direction === 'prev' ? idx - 1 : idx + 1;
    if (newIdx >= 0 && newIdx < s3Files.length) {
      openS3FileView(s3Files[newIdx]);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatS3Date = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const mainFolders = folders.filter(f => !f.parent_folder_id);
  const getSubfolders = (parentId: number) => folders.filter(f => f.parent_folder_id === parentId);
  const totalPhotos = folders.reduce((sum, f) => sum + (f.photo_count || 0), 0);
  const s3Breadcrumbs = s3Prefix.split('/').filter(Boolean);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent hideCloseButton className="max-w-7xl max-h-[100dvh] sm:max-h-[90vh] w-full sm:w-[98vw] h-[100dvh] sm:h-[90vh] overflow-hidden p-0 rounded-none sm:rounded-lg border-0 sm:border gap-0">
          <VisuallyHidden>
            <DialogTitle>Фотобанк пользователя {userName}</DialogTitle>
          </VisuallyHidden>

          <div className="flex flex-col h-full max-h-[100dvh] sm:max-h-[90vh]">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{userName}</h3>
                <p className="text-xs text-muted-foreground">
                  {folders.length} папок • {totalPhotos} фото • ID: {realUserId}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
                <Icon name="X" size={18} />
              </Button>
            </div>

            <Tabs defaultValue="photobank" className="flex-1 flex flex-col overflow-hidden min-h-0" onValueChange={(v) => {
              if (v === 's3' && s3Folders.length === 0 && s3Files.length === 0 && !s3Loading) {
                fetchS3();
              }
            }}>
              <TabsList className="mx-3 sm:mx-4 mt-2 mb-2 grid grid-cols-2 w-auto">
                <TabsTrigger value="photobank" className="gap-1.5 text-xs">
                  <Icon name="Images" size={14} />
                  Фотобанк
                </TabsTrigger>
                <TabsTrigger value="s3" className="gap-1.5 text-xs">
                  <Icon name="HardDrive" size={14} />
                  S3 Бакет
                </TabsTrigger>
              </TabsList>

              <TabsContent value="photobank" className="data-[state=inactive]:!hidden flex-1 overflow-hidden flex flex-col mt-0 min-h-0">
                {selectedFolder && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-4 py-2 border-b bg-muted/30 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleBack}>
                        <Icon name="ArrowLeft" size={16} />
                      </Button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{selectedFolder.folder_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{photos.length} фото • {selectedFolder.s3_prefix || '—'}</p>
                      </div>
                    </div>
                    {photos.length > 0 && (
                      <div className="flex items-center gap-2 pl-9 sm:pl-0 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={toggleSelectAll}>
                          <Checkbox checked={selectedPhotos.size === photos.length && photos.length > 0} className="h-3.5 w-3.5" />
                          Все
                        </Button>
                        {selectedPhotos.size > 0 && (
                          <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleDeleteSelectedPhotos} disabled={deleting}>
                            {deleting ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Trash2" size={14} />}
                            Удалить ({selectedPhotos.size})
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-2.5 sm:p-4">
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
                                <FolderRow folder={folder} onClick={() => handleSelectFolder(folder)} onDelete={(e) => handleDeleteFolder(folder, e)} formatDate={formatDate} deleting={deleting} />
                                {subfolders.length > 0 && (
                                  <div className="ml-6 border-l-2 border-muted pl-2 space-y-1 mt-1">
                                    {subfolders.map(sub => (
                                      <FolderRow key={sub.id} folder={sub} onClick={() => handleSelectFolder(sub)} onDelete={(e) => handleDeleteFolder(sub, e)} formatDate={formatDate} deleting={deleting} isSubfolder />
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                          {photos.map((photo) => {
                            const isSelected = selectedPhotos.has(photo.id);
                            return (
                              <div key={photo.id} className={`relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer group transition-all ${isSelected ? 'ring-2 ring-red-500' : 'hover:ring-2 hover:ring-primary/50'}`} onClick={() => setViewPhoto(photo)}>
                                {photo.is_video ? (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-900"><Icon name="Play" size={32} className="text-white/70" /></div>
                                ) : (
                                  <img src={photo.thumbnail_s3_url || photo.s3_url || ''} alt={photo.file_name} className="w-full h-full object-cover" loading="lazy" />
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                  <p className="text-[10px] text-white truncate">{photo.file_name}</p>
                                  <p className="text-[9px] text-white/70">{formatBytes(photo.file_size)}</p>
                                </div>
                                {photo.is_raw && <span className="absolute top-1 right-1 text-[9px] bg-orange-500 text-white px-1 rounded">RAW</span>}
                                {photo.tech_reject_reason && <span className="absolute top-1 left-7"><Icon name="AlertTriangle" size={14} className="text-red-500 drop-shadow" /></span>}
                                <div className={`absolute top-1 left-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={(e) => togglePhotoSelection(photo.id, e)}>
                                  <Checkbox checked={isSelected} className="h-5 w-5 bg-white/80 border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="s3" className="data-[state=inactive]:!hidden flex-1 overflow-hidden flex flex-col mt-0 min-h-0">
                <div className="px-3 sm:px-4 py-1.5 border-b bg-gray-950/5 dark:bg-gray-50/5">
                  <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-mono overflow-x-auto whitespace-nowrap -mx-1 px-1">
                    <span className="text-muted-foreground shrink-0">{s3Bucket || 'foto-mix'}</span>
                    {s3Breadcrumbs.map((segment, i) => (
                      <span key={i} className="flex items-center gap-1.5 shrink-0">
                        <Icon name="ChevronRight" size={12} className="text-muted-foreground" />
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() => {
                            const newPrefix = s3Breadcrumbs.slice(0, i + 1).join('/') + '/';
                            setS3History(prev => [...prev, s3Prefix]);
                            fetchS3(newPrefix);
                          }}
                        >
                          {segment}
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {s3Loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 sticky top-0 z-10">
                          <th className="text-left px-2.5 sm:px-4 py-1.5 font-medium text-muted-foreground text-xs">Имя</th>
                          <th className="text-right px-2.5 sm:px-4 py-1.5 font-medium text-muted-foreground text-xs w-20 sm:w-28 hidden sm:table-cell">Размер</th>
                          <th className="text-left px-4 py-1.5 font-medium text-muted-foreground text-xs w-32 hidden lg:table-cell">Класс</th>
                          <th className="text-left px-4 py-1.5 font-medium text-muted-foreground text-xs w-40 hidden md:table-cell">Изменено</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s3History.length > 0 && (
                          <tr className="border-b hover:bg-accent/50 cursor-pointer transition-colors" onClick={navigateS3Back}>
                            <td className="px-4 py-1.5" colSpan={4}>
                              <div className="flex items-center gap-2 text-blue-600">
                                <Icon name="CornerLeftUp" size={16} />
                                <span>..</span>
                              </div>
                            </td>
                          </tr>
                        )}
                        {s3Folders.map((folder) => (
                          <tr key={folder.prefix} className="border-b hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => navigateS3(folder.prefix)}>
                            <td className="px-2.5 sm:px-4 py-1.5">
                              <div className="flex items-center gap-2">
                                <Icon name="Folder" size={18} className="text-yellow-500 shrink-0" />
                                <span className="text-blue-600 hover:underline truncate">{folder.name}/</span>
                              </div>
                            </td>
                            <td className="px-2.5 sm:px-4 py-1.5 text-right text-muted-foreground hidden sm:table-cell">—</td>
                            <td className="px-4 py-1.5 text-muted-foreground hidden lg:table-cell">—</td>
                            <td className="px-4 py-1.5 text-muted-foreground hidden md:table-cell">—</td>
                          </tr>
                        ))}
                        {s3Files.map((file) => (
                          <tr key={file.key} className="border-b hover:bg-accent/30 transition-colors group/row">
                            <td className="px-2.5 sm:px-4 py-1.5">
                              <div className="flex items-center gap-2">
                                <Icon
                                  name={isPreviewable(file.name) || isRawFile(file.name) ? 'Image' : isVideoFile(file.name) ? 'Film' : 'File'}
                                  size={18}
                                  className="text-gray-400 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="truncate block" title={file.key}>{file.name}</span>
                                  <span className="text-[10px] text-muted-foreground sm:hidden">{formatBytes(file.size)}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
                                  onClick={() => openS3FileView(file)}
                                  title={isPreviewable(file.name) ? 'Просмотр' : 'Скачать / Открыть'}
                                >
                                  <Icon name={isPreviewable(file.name) || isVideoFile(file.name) ? 'Eye' : 'ExternalLink'} size={15} />
                                </Button>
                              </div>
                            </td>
                            <td className="px-2.5 sm:px-4 py-1.5 text-right text-muted-foreground whitespace-nowrap hidden sm:table-cell">{formatBytes(file.size)}</td>
                            <td className="px-4 py-1.5 text-muted-foreground hidden lg:table-cell">{file.storage_class === 'STANDARD' ? 'Стандартное' : file.storage_class}</td>
                            <td className="px-4 py-1.5 text-muted-foreground whitespace-nowrap hidden md:table-cell">{formatS3Date(file.last_modified)}</td>
                          </tr>
                        ))}
                        {s3Folders.length === 0 && s3Files.length === 0 && !s3Loading && (
                          <tr>
                            <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                              <Icon name="FolderOpen" size={32} className="mx-auto mb-2 opacity-50" />
                              <p className="text-sm">Пустая директория</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {s3ViewFile && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" style={{ pointerEvents: 'auto' }} onClick={() => { setS3ViewFile(null); setS3ViewUrl(''); }}>
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-black/50 shrink-0" onClick={e => e.stopPropagation()}>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-medium truncate">{s3ViewFile.name}</p>
              <p className="text-white/60 text-xs">
                {formatBytes(s3ViewFile.size)}
                {isRawFile(s3ViewFile.name) && <span className="ml-2 bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px]">RAW</span>}
                {isVideoFile(s3ViewFile.name) && <span className="ml-2 bg-blue-500 text-white px-1.5 py-0.5 rounded text-[10px]">VIDEO</span>}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {s3ViewUrl && (
                <a href={s3ViewUrl} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white p-2 transition-colors" title="Открыть в новой вкладке">
                  <Icon name="ExternalLink" size={18} />
                </a>
              )}
              {s3ViewUrl && (
                <a href={s3ViewUrl} download={s3ViewFile.name} className="text-white/70 hover:text-white p-2 transition-colors" title="Скачать">
                  <Icon name="Download" size={18} />
                </a>
              )}
              <button className="text-white/70 hover:text-white p-2 transition-colors" onClick={() => { setS3ViewFile(null); setS3ViewUrl(''); }}>
                <Icon name="X" size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative min-h-0 px-2" onClick={e => e.stopPropagation()}>
            {(() => {
              const currentIdx = s3Files.findIndex(f => f.key === s3ViewFile.key);
              return (
                <>
                  {currentIdx > 0 && (
                    <button className="absolute left-2 sm:left-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors" onClick={() => navigateS3File('prev')}>
                      <Icon name="ChevronLeft" size={24} />
                    </button>
                  )}
                  {currentIdx < s3Files.length - 1 && (
                    <button className="absolute right-2 sm:right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors" onClick={() => navigateS3File('next')}>
                      <Icon name="ChevronRight" size={24} />
                    </button>
                  )}
                </>
              );
            })()}

            {s3ViewLoading ? (
              <Icon name="Loader2" size={40} className="animate-spin text-white/50" />
            ) : !s3ViewUrl ? (
              <p className="text-white/50 text-sm">Не удалось загрузить</p>
            ) : isPreviewable(s3ViewFile.name) ? (
              <img src={s3ViewUrl} alt={s3ViewFile.name} className="max-w-full max-h-full object-contain rounded" />
            ) : isVideoFile(s3ViewFile.name) ? (
              <video src={s3ViewUrl} controls className="max-w-full max-h-full rounded" />
            ) : (
              <div className="text-center text-white/70">
                <Icon name="File" size={64} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-1">{s3ViewFile.name}</p>
                <p className="text-sm text-white/50 mb-4">{formatBytes(s3ViewFile.size)} • {isRawFile(s3ViewFile.name) ? 'RAW файл' : 'Файл'}</p>
                <a href={s3ViewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors">
                  <Icon name="Download" size={16} />
                  Скачать файл
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center px-3 py-2 bg-black/50 shrink-0 text-white/40 text-xs" onClick={e => e.stopPropagation()}>
            {(() => {
              const idx = s3Files.findIndex(f => f.key === s3ViewFile.key);
              return `${idx + 1} / ${s3Files.length}`;
            })()}
          </div>
        </div>,
        document.body
      )}

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
    <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border group" onClick={onClick}>
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${isSubfolder ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-orange-100 dark:bg-orange-950/50'}`}>
        <Icon name={isSubfolder ? 'FolderOpen' : 'Folder'} size={18} className={isSubfolder ? 'text-blue-600' : 'text-orange-600'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="font-medium text-xs sm:text-sm truncate">{folder.folder_name}</span>
          {typeInfo && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeInfo.color}`}>{typeInfo.text}</span>}
          {folder.is_hidden && <Icon name="EyeOff" size={12} className="text-muted-foreground" />}
          {folder.has_password && <Icon name="Lock" size={12} className="text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1"><Icon name="Image" size={12} />{folder.photo_count || 0}</span>
          <span>{formatDate(folder.created_at)}</span>
          {folder.s3_prefix && <span className="text-[10px] font-mono opacity-60 truncate max-w-[120px] sm:max-w-[200px] hidden sm:inline" title={folder.s3_prefix}>{folder.s3_prefix}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {(folder.archive_download_count ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 hidden sm:flex"><Icon name="Download" size={14} />{folder.archive_download_count}</span>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all" onClick={onDelete} disabled={deleting} title="Удалить папку">
          {deleting ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Trash2" size={14} />}
        </Button>
        <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
      </div>
    </div>
  );
};

export default AdminUserPhotoBank;