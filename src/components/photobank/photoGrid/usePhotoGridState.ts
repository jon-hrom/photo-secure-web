import { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { PHOTOBANK_FOLDERS_API } from '@/components/photobank/camera-upload/CameraUploadTypes';
import { downscaleImageToDataUrl } from '@/utils/downscaleImage';
import { usePhotoFrames } from '@/hooks/usePhotoFrames';
import { Photo, PhotoFolder, SortField, SortDirection, naturalCompare } from './photoGridTypes';

interface Params {
  photos: Photo[];
  selectedFolder: PhotoFolder | null;
  selectionMode: boolean;
  onTogglePhotoSelection: (photoId: number) => void;
  userId?: string;
  onRefreshPhotos?: () => void;
}

export function usePhotoGridState({
  photos,
  selectedFolder,
  selectionMode,
  onTogglePhotoSelection,
  userId,
  onRefreshPhotos,
}: Params) {
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [exifPhoto, setExifPhoto] = useState<Photo | null>(null);
  const [viewVideo, setViewVideo] = useState<Photo | null>(null);
  const [posterPhoto, setPosterPhoto] = useState<Photo | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);
  const posterFileInputRef = useRef<HTMLInputElement | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { frameMode, setFrameMode, getFrameStyle } = usePhotoFrames();
  const [regenerating, setRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState<{ done: number; total: number } | null>(null);

  const rawPhotoIds = useMemo(
    () => photos.filter((p) => p.is_raw).map((p) => p.id),
    [photos]
  );

  const handleRegenerateThumbnails = async () => {
    if (regenerating || rawPhotoIds.length === 0) return;
    setRegenerating(true);
    setRegenProgress({ done: 0, total: rawPhotoIds.length });

    const GEN_URL = 'https://functions.poehali.dev/40c5290a-b9a7-48e8-a0a6-68468d29a62c';
    const BATCH = 5;
    let done = 0;
    let failed = 0;
    const toastId = toast.loading(`Пересоздаю превью: 0 из ${rawPhotoIds.length}`);

    try {
      for (let i = 0; i < rawPhotoIds.length; i += BATCH) {
        const batch = rawPhotoIds.slice(i, i + BATCH);
        try {
          const res = await fetch(GEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo_ids: batch, force: true }),
          });
          const data = await res.json();
          done += data?.successful ?? batch.length;
        } catch (e) {
          failed += batch.length;
        }
        setRegenProgress({ done: Math.min(done, rawPhotoIds.length), total: rawPhotoIds.length });
        toast.loading(`Пересоздаю превью: ${Math.min(done, rawPhotoIds.length)} из ${rawPhotoIds.length}`, { id: toastId });
      }

      if (failed === 0) {
        toast.success(`Готово! Обновлено превью: ${done}. Обновите страницу (Ctrl+F5), если картинки не изменились.`, { id: toastId, duration: 8000 });
      } else {
        toast.warning(`Обновлено ${done}, не удалось ${failed}. Попробуйте ещё раз позже.`, { id: toastId, duration: 8000 });
      }
    } finally {
      setRegenerating(false);
      setRegenProgress(null);
    }
  };

  const sortedPhotos = useMemo(() => {
    const sorted = [...photos].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = naturalCompare(a.file_name.toLowerCase(), b.file_name.toLowerCase());
      } else if (sortField === 'shot_date') {
        const aDate = a.shot_date || a.created_at || '';
        const bDate = b.shot_date || b.created_at || '';
        cmp = aDate.localeCompare(bDate);
      } else if (sortField === 'shot_time') {
        const toTime = (d?: string | null) => {
          if (!d) return '';
          const t = new Date(d);
          return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
        };
        cmp = toTime(a.shot_date).localeCompare(toTime(b.shot_date));
      } else {
        const aDate = a.created_at || '';
        const bDate = b.created_at || '';
        cmp = aDate.localeCompare(bDate);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [photos, sortField, sortDirection]);

  // Анализ пропусков в нумерации кадров — признак того, что не все файлы догрузились
  const missingFrames = useMemo(() => {
    if (selectedFolder?.folder_type === 'tech_rejects') return null;
    const nums: number[] = [];
    for (const p of photos) {
      const base = (p.file_name || '').replace(/\.[A-Za-z0-9]+$/, '');
      const matches = base.match(/\d+/g);
      if (matches && matches.length > 0) nums.push(parseInt(matches[matches.length - 1], 10));
    }
    if (nums.length < 5) return null;
    const set = new Set(nums);
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    if (hi - lo <= 0 || hi - lo > 100000) return null;
    const missing: number[] = [];
    for (let n = lo; n <= hi; n++) {
      if (!set.has(n)) missing.push(n);
    }
    if (missing.length === 0) return null;
    return { count: missing.length, expected: hi - lo + 1, actual: set.size, sample: missing.slice(0, 30) };
  }, [photos, selectedFolder]);

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const applyVideoPoster = async (payload: Record<string, unknown>) => {
    if (!posterPhoto || !userId) return;
    setPosterBusy(true);
    try {
      const res = await fetch(PHOTOBANK_FOLDERS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ action: 'set_video_poster', photo_id: posterPhoto.id, ...payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Ошибка сервера (${res.status})`);
      }
      toast.success('Обложка обновлена');
      setPosterPhoto(null);
      onRefreshPhotos?.();
    } catch (e) {
      console.error('[VIDEO_POSTER] failed:', e);
      toast.error(e instanceof Error ? `Не удалось обновить обложку: ${e.message}` : 'Не удалось обновить обложку');
    } finally {
      setPosterBusy(false);
    }
  };

  const handlePosterFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPosterBusy(true);
    try {
      // Уменьшаем картинку до отправки — иначе большой JPG в base64 упирается
      // в лимит тела облачной функции и обложка не сохраняется.
      const imageData = await downscaleImageToDataUrl(file, 1280, 0.85);
      await applyVideoPoster({ image_data: imageData });
    } catch (err) {
      console.error('[VIDEO_POSTER] prepare failed:', err);
      toast.error('Не удалось обработать картинку');
      setPosterBusy(false);
    }
  };

  const handleResetPoster = () => applyVideoPoster({ reset: true });

  const handlePhotoClick = (photo: Photo) => {
    if (!selectionMode) {
      if (photo.is_video) {
        setViewVideo(photo);
      } else {
        setViewPhoto(photo);
      }
    } else {
      onTogglePhotoSelection(photo.id);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!viewPhoto) return;
    const currentIndex = sortedPhotos.findIndex(p => p.id === viewPhoto.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < sortedPhotos.length) {
      setViewPhoto(sortedPhotos[newIndex]);
    }
  };

  return {
    viewPhoto,
    setViewPhoto,
    exifPhoto,
    setExifPhoto,
    viewVideo,
    setViewVideo,
    posterPhoto,
    setPosterPhoto,
    posterBusy,
    posterFileInputRef,
    sortField,
    sortDirection,
    frameMode,
    setFrameMode,
    getFrameStyle,
    regenerating,
    regenProgress,
    rawPhotoIds,
    sortedPhotos,
    missingFrames,
    handleRegenerateThumbnails,
    handleSortChange,
    handlePosterFileSelected,
    handleResetPoster,
    handlePhotoClick,
    handleNavigate,
  };
}

export default usePhotoGridState;
