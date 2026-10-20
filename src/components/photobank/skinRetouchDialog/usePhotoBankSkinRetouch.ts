import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveBlobToPhotoBank } from '@/components/tools/saveToPhotoBank';
import { useToast } from '@/hooks/use-toast';
import { usePlasticParams, isPlasticZero, detectPeople, zoneMask, activeZones } from '@/components/tools/skinRetouch/plastic';
import { runSlim, maskToB64 } from '@/components/tools/skinRetouch/runSlim';
import {
  PRESETS,
  PresetKey,
  EyeSharpenKey,
  SKIN_RETOUCH_URL,
  imageToDataUrl,
} from '@/components/tools/skinRetouch/utils';
import {
  NotEnoughEnergyError,
  friendlyRetouchError,
  runSkinRetouch,
} from '@/components/tools/skinRetouch/runSkinRetouch';
import {
  SourceImage, loadSourceFromUrl, exportFullRes, dataUrlToCanvas,
} from '@/components/tools/objectRemover/fullRes';
import {
  PHOTOBANK_FOLDERS_API,
  RAW_CONVERT_URL,
  RAW_CONVERT_CONCURRENCY,
  RETOUCH_FOLDER_NAME,
  BATCH_CONCURRENCY,
  Photo,
  BatchItem,
  Props,
  isRaw,
  isRetouchable,
  thumbOf,
} from '@/components/photobank/skinRetouchDialog/shared';

export const usePhotoBankSkinRetouch = ({
  open,
  onOpenChange,
  folderId,
  userId,
  preselectedPhotoId,
  onRetouchComplete,
}: Omit<Props, 'folderName'>) => {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [preset, setPreset] = useState<PresetKey>('medium');
  const [eyeSharpen, setEyeSharpen] = useState<EyeSharpenKey>(
    () => (localStorage.getItem('retouch_eye_sharpen') as EyeSharpenKey) || 'normal',
  );
  useEffect(() => {
    localStorage.setItem('retouch_eye_sharpen', eyeSharpen);
  }, [eyeSharpen]);
  const [removeChin, setRemoveChin] = useState<boolean>(
    () => localStorage.getItem('retouch_remove_chin') === '1',
  );
  useEffect(() => {
    localStorage.setItem('retouch_remove_chin', removeChin ? '1' : '0');
  }, [removeChin]);
  const { params: plastic, setParams: setPlastic } = usePlasticParams();
  const [price, setPrice] = useState<number | null>(null);
  const [tab, setTab] = useState<'single' | 'all'>('single');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Одно фото
  const [singleBusy, setSingleBusy] = useState(false);
  const [singleText, setSingleText] = useState('');
  const [singleOriginal, setSingleOriginal] = useState('');
  const [singleResult, setSingleResult] = useState('');
  const [compare, setCompare] = useState(50);

  // Вся папка
  const [items, setItems] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  const cancelRef = useRef(false);
  const retouchFolderIdRef = useRef<number | null>(null);
  /** Фоновые конвертации RAW → JPEG: id фото → промис с URL готового JPEG. */
  const rawJobsRef = useRef<Map<number, Promise<string>>>(new Map());

  const retouchable = useMemo(() => photos.filter(isRetouchable), [photos]);
  const skippedCount = photos.length - retouchable.length;
  const busy = singleBusy || batchRunning;

  const loadPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const res = await fetch(`${PHOTOBANK_FOLDERS_API}?action=list_photos&folder_id=${folderId}`, {
        headers: { 'X-User-Id': userId },
      });
      const data = await res.json();
      const list: Photo[] = data.photos || [];
      setPhotos(list);
      // Сразу запускаем фоновую конвертацию RAW без готового JPEG,
      // чтобы к моменту нажатия «Отретушировать» всё было готово.
      const missing = list.filter((p) => isRetouchable(p) && isRaw(p) && !p.thumbnail_s3_url);
      startRawConversion(missing);
    } catch (e) {
      console.error('[SKIN_RETOUCH] load photos failed', e);
    } finally {
      setLoadingPhotos(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId, userId]);

  /** Получает свежий URL JPEG-превью для фото (после конвертации). */
  const fetchPreviewUrl = useCallback(
    async (photoId: number): Promise<string> => {
      const res = await fetch(`${PHOTOBANK_FOLDERS_API}?action=list_photos&folder_id=${folderId}`, {
        headers: { 'X-User-Id': userId },
      });
      const data = await res.json();
      const fresh: Photo[] = data.photos || [];
      setPhotos(fresh);
      return fresh.find((p) => p.id === photoId)?.thumbnail_s3_url || '';
    },
    [folderId, userId],
  );

  const convertOne = useCallback(
    async (photoId: number): Promise<string> => {
      const res = await fetch(RAW_CONVERT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: photoId }),
      });
      const data = await res.json().catch(() => ({}));
      const r = data?.results?.[0];
      if (!res.ok || !r || r.error) throw new Error(r?.error || data?.error || 'Не удалось конвертировать RAW в JPG');
      const url = await fetchPreviewUrl(photoId);
      if (!url) throw new Error('JPG из RAW ещё не готов, попробуйте через минуту');
      return url;
    },
    [fetchPreviewUrl],
  );

  /** Ставит RAW-файлы в очередь конвертации (параллельно, не больше RAW_CONVERT_CONCURRENCY). */
  function startRawConversion(list: Photo[]) {
    const jobs = rawJobsRef.current;
    const todo = list.filter((p) => !jobs.has(p.id));
    if (!todo.length) return;
    let active = 0;
    const waiters: Array<() => void> = [];
    const acquire = () =>
      new Promise<void>((resolve) => {
        if (active < RAW_CONVERT_CONCURRENCY) {
          active += 1;
          resolve();
        } else waiters.push(() => { active += 1; resolve(); });
      });
    const release = () => {
      active -= 1;
      waiters.shift()?.();
    };
    for (const p of todo) {
      const job = (async () => {
        await acquire();
        try {
          return await convertOne(p.id);
        } finally {
          release();
        }
      })();
      job.catch(() => jobs.delete(p.id)); // при ошибке разрешаем повторную попытку
      jobs.set(p.id, job);
    }
  }

  /** URL JPEG-источника для ретуши: обычное фото — оригинал, RAW — сконвертированный JPEG. */
  const getSourceUrl = useCallback(
    async (photo: Photo, onStatus: (t: string) => void): Promise<string> => {
      if (!isRaw(photo)) return photo.s3_url!;
      const current = photos.find((p) => p.id === photo.id)?.thumbnail_s3_url || photo.thumbnail_s3_url;
      if (current) return current;
      onStatus('Конвертируем RAW в JPG...');
      let job = rawJobsRef.current.get(photo.id);
      if (!job) {
        job = convertOne(photo.id);
        rawJobsRef.current.set(photo.id, job);
        job.catch(() => rawJobsRef.current.delete(photo.id));
      }
      return job;
    },
    [convertOne, photos],
  );

  useEffect(() => {
    if (!open) return;
    rawJobsRef.current = new Map();
    cancelRef.current = false;
    retouchFolderIdRef.current = null;
    setItems([]);
    setSingleResult('');
    setSingleOriginal('');
    setSelectedId(preselectedPhotoId ?? null);
    setTab('single');
    loadPhotos();
  }, [open, folderId, preselectedPhotoId, loadPhotos]);

  useEffect(() => {
    if (!open || price !== null) return;
    fetch(`${SKIN_RETOUCH_URL}?action=estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.json())
      .then((d) => setPrice(d?.price ?? null))
      .catch(() => undefined);
  }, [open, price]);

  /** Находит или создаёт подпапку «Ретуширование фото» внутри текущей папки. */
  const ensureRetouchFolder = useCallback(async (): Promise<number> => {
    if (retouchFolderIdRef.current) return retouchFolderIdRef.current;
    const listRes = await fetch(`${PHOTOBANK_FOLDERS_API}?action=list`, { headers: { 'X-User-Id': userId } });
    const listData = await listRes.json();
    const existing = (listData.folders || []).find(
      (f: { id: number; folder_name: string; parent_folder_id: number | null }) =>
        f.parent_folder_id === folderId && f.folder_name === RETOUCH_FOLDER_NAME,
    );
    if (existing) {
      retouchFolderIdRef.current = existing.id;
      return existing.id;
    }
    const res = await fetch(PHOTOBANK_FOLDERS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({ action: 'create', folder_name: RETOUCH_FOLDER_NAME, parent_folder_id: folderId }),
    });
    const data = await res.json();
    if (!res.ok || !data?.folder?.id) throw new Error(data?.error || 'Не удалось создать папку');
    retouchFolderIdRef.current = data.folder.id;
    return data.folder.id;
  }, [folderId, userId]);

  /** Сохраняет результат в исходном разрешении, с именем и EXIF оригинала. */
  const saveResult = useCallback(
    async (src: SourceImage, imageB64: string) => {
      const targetId = await ensureRetouchFolder();
      const edited = await dataUrlToCanvas(`data:image/jpeg;base64,${imageB64}`);
      const exp = await exportFullRes(src, edited, 'auto');
      await saveBlobToPhotoBank({
        userId, folderId: targetId, blob: exp.blob, fileName: exp.name, width: exp.width, height: exp.height,
      });
    },
    [ensureRetouchFolder, userId],
  );

  const processPhoto = useCallback(
    async (photo: Photo, onStatus: (t: string) => void) => {
      const srcUrl = await getSourceUrl(photo, onStatus);
      onStatus('Загружаем фото...');
      // У RAW берём сконвертированный JPEG, но имя оставляем исходное (с расширением .jpg)
      const baseName = isRaw(photo)
        ? `${(photo.file_name || 'photo').replace(/\.[^.]+$/, '')}.jpg`
        : photo.file_name;
      const src = await loadSourceFromUrl(srcUrl, baseName);
      // EXIF у превью RAW не тот — не переносим
      if (isRaw(photo)) src.bytes = null;
      const sourceDataUrl = imageToDataUrl(src.img);
      const result = await runSkinRetouch({
        userId,
        sourceDataUrl,
        preset,
        eyeSharpen,
        removeChin,
        onStatus,
        isCancelled: () => cancelRef.current,
      });
      if (!isPlasticZero(plastic)) {
        // Пиксели не растягиваем: AI перерисовывает только зоны по точкам лица и позы.
        onStatus('Ищем людей для пластики...');
        try {
          const dataUrl = `data:image/jpeg;base64,${result.image}`;
          const { img, geo, people } = await detectPeople(dataUrl);
          if (people.length) {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            const mask = document.createElement('canvas');
            mask.width = w;
            mask.height = h;
            const mctx = mask.getContext('2d')!;
            for (const person of people) mctx.drawImage(zoneMask(w, h, geo, person, plastic), 0, 0);
            const res = await runSlim({
              userId,
              imageB64: result.image,
              maskB64: maskToB64(mask, w, h),
              onStatus,
              mode: 'plastic',
              zones: activeZones(plastic),
            });
            result.image = res.image;
            result.energy_balance = res.energy_balance ?? result.energy_balance;
          }
        } catch (e) {
          console.warn('[PLASTIC] AI plastic failed', e);
          toast({ title: 'AI-пластика не удалась', description: `${String((e as Error)?.message || e)}. Энергия возвращена.`, variant: 'destructive' });
        }
      }
      onStatus('Сохраняем в папку...');
      await saveResult(src, result.image);
      return { sourceDataUrl, result };
    },
    [eyeSharpen, removeChin, plastic, getSourceUrl, preset, saveResult, userId, toast],
  );

  const runSingle = async () => {
    const photo = retouchable.find((p) => p.id === selectedId);
    if (!photo) return;
    cancelRef.current = false;
    setSingleBusy(true);
    setSingleResult('');
    try {
      const { sourceDataUrl, result } = await processPhoto(photo, setSingleText);
      setSingleOriginal(sourceDataUrl);
      setSingleResult(`data:image/jpeg;base64,${result.image}`);
      setCompare(50);
      toast({
        title: 'Готово',
        description: `Сохранено в «${RETOUCH_FOLDER_NAME}». Осталось ${result.energy_balance ?? '—'} ⚡`,
      });
      onRetouchComplete?.();
    } catch (e) {
      console.error(e);
      toast({
        title: e instanceof NotEnoughEnergyError ? 'Не хватает энергии' : 'Не удалось отретушировать',
        description: friendlyRetouchError(e),
        variant: 'destructive',
      });
    } finally {
      setSingleBusy(false);
      setSingleText('');
    }
  };

  const updateItem = (id: number, patch: Partial<BatchItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const runBatch = async (only?: number[]) => {
    const list = only ? retouchable.filter((p) => only.includes(p.id)) : retouchable;
    if (list.length === 0) return;
    cancelRef.current = false;
    setBatchRunning(true);
    if (only) {
      setItems((prev) => prev.map((it) => (only.includes(it.id) ? { ...it, status: 'pending', text: '' } : it)));
    } else {
      setItems(list.map((p) => ({ id: p.id, file_name: p.file_name, thumb: thumbOf(p), status: 'pending' })));
    }

    try {
      await ensureRetouchFolder();
    } catch (e) {
      toast({ title: 'Не удалось создать папку', description: String((e as Error)?.message || e), variant: 'destructive' });
      setBatchRunning(false);
      return;
    }

    const queue = [...list];
    let done = 0;
    let failed = 0;
    let noEnergy = false;

    const worker = async () => {
      while (queue.length && !cancelRef.current && !noEnergy) {
        const photo = queue.shift()!;
        updateItem(photo.id, { status: 'processing', text: 'В работе...' });
        try {
          await processPhoto(photo, (t) => updateItem(photo.id, { text: t }));
          done += 1;
          updateItem(photo.id, { status: 'done', text: 'Готово' });
        } catch (e) {
          failed += 1;
          if (e instanceof NotEnoughEnergyError) noEnergy = true;
          updateItem(photo.id, { status: 'failed', text: friendlyRetouchError(e) });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, list.length) }, worker));
    setBatchRunning(false);
    onRetouchComplete?.();

    if (noEnergy) {
      toast({ title: 'Не хватает энергии', description: 'Пополните баланс и повторите для оставшихся фото.', variant: 'destructive' });
    } else if (cancelRef.current) {
      toast({ title: 'Остановлено', description: `Готово ${done} из ${list.length}` });
    } else {
      toast({
        title: 'Ретушь папки завершена',
        description: `Готово ${done}${failed ? `, с ошибкой ${failed}` : ''}. Фото в «${RETOUCH_FOLDER_NAME}».`,
      });
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v && busy) {
      if (!window.confirm('Ретушь ещё идёт. Остановить и закрыть? Уже готовые фото сохранены.')) return;
      cancelRef.current = true;
    }
    onOpenChange(v);
  };

  const doneCount = items.filter((i) => i.status === 'done').length;
  const failedIds = items.filter((i) => i.status === 'failed').map((i) => i.id);
  const finishedCount = items.filter((i) => i.status === 'done' || i.status === 'failed').length;
  const activePreset = PRESETS.find((p) => p.key === preset);

  return {
    loadingPhotos,
    preset,
    setPreset,
    eyeSharpen,
    setEyeSharpen,
    removeChin,
    setRemoveChin,
    plastic,
    setPlastic,
    price,
    tab,
    setTab,
    selectedId,
    setSelectedId,
    singleBusy,
    singleText,
    singleOriginal,
    singleResult,
    setSingleResult,
    compare,
    setCompare,
    items,
    setItems,
    batchRunning,
    cancelRef,
    retouchable,
    skippedCount,
    busy,
    runSingle,
    runBatch,
    handleOpenChange,
    doneCount,
    failedIds,
    finishedCount,
    activePreset,
  };
};
