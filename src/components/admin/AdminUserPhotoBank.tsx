import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import PhotoGridViewer from '@/components/photobank/PhotoGridViewer';
import PhotobankTab from './photobank/PhotobankTab';
import S3BrowserTab from './photobank/S3BrowserTab';
import S3FileViewer from './photobank/S3FileViewer';
import type { PhotoFolder, Photo, S3Folder, S3File } from './photobank/types';
import { API_URL, formatBytes } from './photobank/types';

interface AdminUserPhotoBankProps {
  userId: string | number;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

const AdminUserPhotoBank = ({ userId, userName, isOpen, onClose }: AdminUserPhotoBankProps) => {
  const [folders, setFolders] = useState<PhotoFolder[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<PhotoFolder | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [s3Uploading, setS3Uploading] = useState(false);

  const [s3Folders, setS3Folders] = useState<S3Folder[]>([]);
  const [s3Files, setS3Files] = useState<S3File[]>([]);
  const [s3Prefix, setS3Prefix] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Loading, setS3Loading] = useState(false);
  const [s3History, setS3History] = useState<string[]>([]);
  const [s3ViewFile, setS3ViewFile] = useState<S3File | null>(null);
  const viewerJustClosedRef = useRef(false);

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

  const handleS3BreadcrumbClick = (newPrefix: string) => {
    setS3History(prev => [...prev, s3Prefix]);
    fetchS3(newPrefix);
  };

  const handleS3Upload = async (files: FileList) => {
    if (!files.length || !s3Prefix) return;
    setS3Uploading(true);
    let uploaded = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const s3Key = s3Prefix + file.name;
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 's3_upload',
            user_id: realUserId,
            file_data: base64,
            file_name: file.name,
            s3_key: s3Key,
            content_type: file.type || 'application/octet-stream'
          })
        });
        const data = await res.json();
        if (data.ok) uploaded++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setS3Uploading(false);
    if (uploaded > 0) toast.success(`Загружено ${uploaded} файл(ов)`);
    if (failed > 0) toast.error(`Ошибка загрузки ${failed} файл(ов)`);
    fetchS3(s3Prefix);
  };

  const totalPhotos = folders.reduce((sum, f) => sum + (f.photo_count || 0), 0);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !s3ViewFile && !viewPhoto && !viewerJustClosedRef.current) onClose(); }}>
        <DialogContent hideCloseButton className="max-w-7xl max-h-[100dvh] sm:max-h-[90vh] w-full sm:w-[98vw] h-[100dvh] sm:h-[90vh] overflow-hidden p-0 rounded-none sm:rounded-lg border-0 sm:border gap-0" onEscapeKeyDown={(e) => { if (s3ViewFile || viewPhoto || viewerJustClosedRef.current) e.preventDefault(); }} onPointerDownOutside={(e) => { if (s3ViewFile || viewPhoto || viewerJustClosedRef.current) e.preventDefault(); }} onInteractOutside={(e) => { if (s3ViewFile || viewPhoto || viewerJustClosedRef.current) e.preventDefault(); }}>
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
                <PhotobankTab
                  folders={folders}
                  photos={photos}
                  selectedFolder={selectedFolder}
                  loadingFolders={loadingFolders}
                  loadingPhotos={loadingPhotos}
                  selectedPhotos={selectedPhotos}
                  deleting={deleting}
                  onSelectFolder={handleSelectFolder}
                  onBack={handleBack}
                  onDeleteFolder={handleDeleteFolder}
                  onDeleteSelectedPhotos={handleDeleteSelectedPhotos}
                  onTogglePhotoSelection={togglePhotoSelection}
                  onToggleSelectAll={toggleSelectAll}
                  onViewPhoto={setViewPhoto}
                />
              </TabsContent>

              <TabsContent value="s3" className="data-[state=inactive]:!hidden flex-1 overflow-hidden flex flex-col mt-0 min-h-0">
                <S3BrowserTab
                  s3Folders={s3Folders}
                  s3Files={s3Files}
                  s3Prefix={s3Prefix}
                  s3Bucket={s3Bucket}
                  s3Loading={s3Loading}
                  s3History={s3History}
                  uploading={s3Uploading}
                  onNavigate={navigateS3}
                  onNavigateBack={navigateS3Back}
                  onViewFile={setS3ViewFile}
                  onBreadcrumbClick={handleS3BreadcrumbClick}
                  onUploadFiles={handleS3Upload}
                />
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {s3ViewFile && (
        <S3FileViewer
          file={s3ViewFile}
          files={s3Files}
          realUserId={realUserId}
          onClose={() => {
            viewerJustClosedRef.current = true;
            setS3ViewFile(null);
            setTimeout(() => { viewerJustClosedRef.current = false; }, 300);
          }}
        />
      )}

      {viewPhoto && (
        <PhotoGridViewer
          viewPhoto={viewPhoto}
          photos={photos}
          onClose={() => {
            viewerJustClosedRef.current = true;
            setViewPhoto(null);
            setTimeout(() => { viewerJustClosedRef.current = false; }, 300);
          }}
          onNavigate={handleNavigate}
          onDownload={handleDownload}
          formatBytes={formatBytes}
          downloadDisabled={false}
        />
      )}
    </>
  );
};

export default AdminUserPhotoBank;