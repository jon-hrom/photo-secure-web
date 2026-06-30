import { useEffect, useState } from 'react';
import * as zip from '@zip.js/zip.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import PhotoGridViewer from './PhotoGridViewer';

const FAVORITES_URL = 'https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723';

interface ListPhoto {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url: string;
  width: number | null;
  height: number | null;
  file_size: number;
  s3_key?: string;
}

interface FavoriteListPhotographerViewProps {
  open: boolean;
  onClose: () => void;
  listId: number;
  listName: string;
  userId: number;
  initialPhotoId?: number | null;
}

export default function FavoriteListPhotographerView({
  open,
  onClose,
  listId,
  listName,
  userId,
  initialPhotoId = null,
}: FavoriteListPhotographerViewProps) {
  const [photos, setPhotos] = useState<ListPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewPhoto, setViewPhoto] = useState<ListPhoto | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadCurrent, setDownloadCurrent] = useState('');
  const [coverPhotoId, setCoverPhotoId] = useState<number | null>(null);
  const [vignettePhotoId, setVignettePhotoId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${FAVORITES_URL}?action=photographer_list_photos&list_id=${listId}`, {
      headers: { 'X-User-Id': userId.toString() },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list: ListPhoto[] = (data?.photos || []).map((p: ListPhoto) => p);
        setPhotos(list);
        setCoverPhotoId(data?.cover_photo_id ?? null);
        setVignettePhotoId(data?.vignette_photo_id ?? null);
        if (initialPhotoId) {
          const found = list.find((p) => p.id === initialPhotoId);
          if (found) setViewPhoto(found);
        }
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, [open, listId, userId, initialPhotoId]);

  const handleDownloadOne = async (photo: ListPhoto) => {
    try {
      const fileResponse = await fetch(photo.photo_url);
      if (!fileResponse.ok) throw new Error('fetch failed');
      const blob = await fileResponse.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
      console.error('download photo error', e);
      alert('Не удалось скачать фото');
    }
  };

  const handleDownloadAll = async () => {
    if (!photos.length) return;
    const ok = window.confirm(
      `Скачать ${photos.length} фото из списка «${listName}» архивом?\n\nФайлы будут упакованы в ZIP. Это может занять время.`,
    );
    if (!ok) return;

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadCurrent('');

    try {
      const zipFileStream = new zip.BlobWriter();
      const zipWriter = new zip.ZipWriter(zipFileStream);
      const used = new Set<string>();

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        setDownloadCurrent(photo.file_name);
        setDownloadProgress(Math.round((i / photos.length) * 90));
        try {
          const resp = await fetch(photo.photo_url);
          if (!resp.ok || !resp.body) continue;
          let filename = photo.file_name;
          if (used.has(filename)) {
            const dot = filename.lastIndexOf('.');
            const ext = dot >= 0 ? filename.substring(dot) : '';
            const base = dot >= 0 ? filename.substring(0, dot) : filename;
            let n = 1;
            do {
              filename = `${base}_${n}${ext}`;
              n++;
            } while (used.has(filename));
          }
          used.add(filename);
          await zipWriter.add(filename, resp.body, { level: 0 });
        } catch {
          /* skip file */
        }
      }

      setDownloadCurrent('Создание архива...');
      setDownloadProgress(95);
      const zipBlob = await zipWriter.close();

      const safeName = (listName || 'favorite-list').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'favorite-list';
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 200);

      setDownloadProgress(100);
      setDownloadCurrent('Готово');
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(0);
        setDownloadCurrent('');
      }, 1200);
    } catch (e) {
      console.error('zip error', e);
      alert('Ошибка при создании архива');
      setDownloading(false);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!viewPhoto) return;
    const idx = photos.findIndex((p) => p.id === viewPhoto.id);
    if (idx === -1) return;
    const next = direction === 'prev' ? idx - 1 : idx + 1;
    if (next >= 0 && next < photos.length) setViewPhoto(photos[next]);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <div className="flex items-center gap-3 pr-10">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg min-w-0">
                <Icon name="Star" size={18} className="text-yellow-500 flex-shrink-0" />
                <span className="truncate">{listName}</span>
                <span className="text-xs font-normal text-muted-foreground flex-shrink-0">({photos.length} фото)</span>
              </DialogTitle>
              <div className="flex-1 flex justify-center">
                <Button
                  onClick={handleDownloadAll}
                  disabled={downloading || photos.length === 0}
                  size="sm"
                  className="gap-1.5"
                >
                  <Icon name="Download" size={14} />
                  Скачать всё архивом
                </Button>
              </div>
            </div>
            {downloading && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{downloadCurrent}</span>
                  <span>{downloadProgress}%</span>
                </div>
                <Progress value={downloadProgress} className="h-1.5" />
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <Icon name="Loader2" size={28} className="animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && photos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
                <Icon name="ImageOff" size={36} />
                <p className="text-sm">В списке нет доступных фото</p>
              </div>
            )}
            {!loading && photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="relative group rounded-lg overflow-hidden cursor-pointer bg-muted aspect-square"
                    onClick={() => setViewPhoto(p)}
                  >
                    <img
                      src={p.thumbnail_url}
                      alt={p.file_name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadOne(p); }}
                      className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-blue-500 text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                      title="Скачать"
                    >
                      <Icon name="Download" size={13} />
                    </button>
                    <div className="absolute top-1 left-1 flex flex-col gap-1 items-start">
                      <span className="px-1.5 py-0.5 rounded bg-black/55 text-white text-[10px] font-mono">
                        #{p.id}
                      </span>
                      {coverPhotoId === p.id && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-medium">
                          <Icon name="Image" size={10} /> Обложка
                        </span>
                      )}
                      {vignettePhotoId === p.id && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-medium">
                          <Icon name="Sparkles" size={10} /> Виньетка
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {viewPhoto && (
        <PhotoGridViewer
          viewPhoto={{
            id: viewPhoto.id,
            file_name: viewPhoto.file_name,
            s3_url: viewPhoto.photo_url,
            s3_key: viewPhoto.s3_key,
            thumbnail_s3_url: viewPhoto.thumbnail_url,
            width: viewPhoto.width,
            height: viewPhoto.height,
            file_size: viewPhoto.file_size,
            created_at: '',
          }}
          photos={photos.map((p) => ({
            id: p.id,
            file_name: p.file_name,
            s3_url: p.photo_url,
            s3_key: p.s3_key,
            thumbnail_s3_url: p.thumbnail_url,
            width: p.width,
            height: p.height,
            file_size: p.file_size,
            created_at: '',
          }))}
          onClose={() => setViewPhoto(null)}
          onNavigate={handleNavigate}
          onDownload={async (s3Key, fileName) => {
            const photo = photos.find((p) => p.s3_key === s3Key || p.file_name === fileName);
            if (photo) await handleDownloadOne(photo);
          }}
          formatBytes={formatBytes}
        />
      )}
    </>
  );
}