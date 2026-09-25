import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import CompareView from '@/components/tools/skinRetouch/CompareView';
import {
  PRESETS,
  PresetKey,
  SKIN_RETOUCH_URL,
  imageToDataUrl,
  urlToImage,
} from '@/components/tools/skinRetouch/utils';
import {
  NotEnoughEnergyError,
  friendlyRetouchError,
  runSkinRetouch,
} from '@/components/tools/skinRetouch/runSkinRetouch';

const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';
/** Конвертер RAW → JPEG (превью 2400px, для ретуши его более чем достаточно — модель работает с 1600px). */
const RAW_CONVERT_URL = 'https://functions.poehali.dev/40c5290a-b9a7-48e8-a0a6-68468d29a62c';
const RAW_CONVERT_CONCURRENCY = 4;
const RETOUCH_FOLDER_NAME = 'Ретуширование фото';
const BATCH_CONCURRENCY = 2;
const RAW_RE = /\.(cr2|cr3|nef|nrw|arw|srf|sr2|dng|orf|rw2|raf|pef|raw|rwl|iiq|3fr)$/i;

interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  is_video?: boolean;
  is_raw?: boolean;
  content_type?: string;
}

type ItemStatus = 'pending' | 'processing' | 'done' | 'failed';

interface BatchItem {
  id: number;
  file_name: string;
  thumb: string;
  status: ItemStatus;
  text?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: number;
  folderName: string;
  userId: string;
  preselectedPhotoId?: number;
  onRetouchComplete?: () => void;
}

const isRaw = (p: Photo) => !!p.is_raw || RAW_RE.test(p.file_name || '');

const isRetouchable = (p: Photo) =>
  !p.is_video && !(p.content_type || '').startsWith('video/') && (isRaw(p) || !!p.s3_url);

/** Для RAW показываем только JPEG-превью (сам RAW браузер не отрисует). */
const thumbOf = (p: Photo) => (isRaw(p) ? p.thumbnail_s3_url || '' : p.thumbnail_s3_url || p.s3_url || '');

const PhotoBankSkinRetouchDialog = ({
  open,
  onOpenChange,
  folderId,
  folderName,
  userId,
  preselectedPhotoId,
  onRetouchComplete,
}: Props) => {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [preset, setPreset] = useState<PresetKey>('medium');
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

  const saveResult = useCallback(
    async (photo: Photo, imageB64: string) => {
      const targetId = await ensureRetouchFolder();
      const dataUrl = `data:image/jpeg;base64,${imageB64}`;
      const img = await urlToImage(dataUrl);
      const base = (photo.file_name || 'photo').replace(/\.[^.]+$/, '');
      const res = await fetch(PHOTOBANK_FOLDERS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          action: 'upload_direct',
          folder_id: targetId,
          file_name: `${base}-retouch-${preset}.jpg`,
          file_data: dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Сохранение: HTTP ${res.status}`);
    },
    [ensureRetouchFolder, preset, userId],
  );

  const processPhoto = useCallback(
    async (photo: Photo, onStatus: (t: string) => void) => {
      const srcUrl = await getSourceUrl(photo, onStatus);
      onStatus('Загружаем фото...');
      const img = await urlToImage(srcUrl);
      const sourceDataUrl = imageToDataUrl(img);
      const result = await runSkinRetouch({
        userId,
        sourceDataUrl,
        preset,
        onStatus,
        isCancelled: () => cancelRef.current,
      });
      onStatus('Сохраняем в папку...');
      await saveResult(photo, result.image);
      return { sourceDataUrl, result };
    },
    [getSourceUrl, preset, saveResult, userId],
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-1rem)] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="Sparkles" size={18} className="text-primary" />
            Ретушь фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Папка: {folderName}. Результаты сохраняются в подпапку «{RETOUCH_FOLDER_NAME}»
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="text-xs font-medium mb-2">Сила ретуши</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                disabled={busy}
                onClick={() => setPreset(p.key)}
                className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                  preset === p.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {activePreset && <p className="text-[11px] text-muted-foreground mt-1.5">{activePreset.hint}</p>}
        </div>

        <Tabs value={tab} onValueChange={(v) => !busy && setTab(v as 'single' | 'all')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10 sm:h-9">
            <TabsTrigger value="single" disabled={busy} className="text-xs sm:text-sm">
              <Icon name="Image" size={14} className="mr-1.5" />
              Одно фото
            </TabsTrigger>
            <TabsTrigger value="all" disabled={busy} className="text-xs sm:text-sm">
              <Icon name="Images" size={14} className="mr-1.5" />
              Вся папка
            </TabsTrigger>
          </TabsList>

          {loadingPhotos ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="Loader2" size={24} className="animate-spin mx-auto mb-2" />
              <p className="text-xs sm:text-sm">Загрузка фото...</p>
            </div>
          ) : retouchable.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="ImageOff" size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs sm:text-sm">В папке нет фото для ретуши (JPG/PNG/WEBP/RAW)</p>
            </div>
          ) : (
            <>
              <TabsContent value="single" className="mt-3 space-y-3">
                {singleResult ? (
                  <>
                    <CompareView originalUrl={singleOriginal} resultUrl={singleResult} compare={compare} setCompare={setCompare} />
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSingleResult('')}>
                      <Icon name="RotateCcw" size={16} />
                      Другое фото
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 max-h-64 overflow-y-auto">
                      {retouchable.map((p) => (
                        <button
                          key={p.id}
                          disabled={busy}
                          onClick={() => setSelectedId(p.id)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedId === p.id ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary/30'
                          }`}
                        >
                          {thumbOf(p) ? (
                            <img src={thumbOf(p)} alt={p.file_name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-1 text-muted-foreground">
                              <Icon name="Loader2" size={16} className="animate-spin" />
                              <span className="text-[10px]">RAW → JPG</span>
                            </div>
                          )}
                          {isRaw(p) && (
                            <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">RAW</span>
                          )}
                          {selectedId === p.id && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Icon name="Check" size={22} className="text-white drop-shadow-lg" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {singleBusy ? (
                      <div className="rounded-lg border border-border p-3 flex items-center gap-3">
                        <Icon name="Loader2" size={20} className="animate-spin text-primary" />
                        <div>
                          <p className="text-sm font-medium">{singleText || 'Обработка...'}</p>
                          <p className="text-[11px] text-muted-foreground">Обычно 20–60 секунд</p>
                        </div>
                      </div>
                    ) : (
                      <Button onClick={runSingle} disabled={!selectedId} className="w-full sm:w-auto gap-2">
                        <Icon name="Sparkles" size={16} />
                        Отретушировать{price !== null ? ` · ${price} ⚡` : ''}
                      </Button>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="all" className="mt-3 space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-lg border border-border p-4 space-y-2">
                    <p className="text-sm">
                      Будет обработано <b>{retouchable.length}</b> фото
                      {price !== null && (
                        <>
                          {' '}— примерно <b>{retouchable.length * price} ⚡</b>
                        </>
                      )}
                    </p>
                    {skippedCount > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Пропущено {skippedCount} (видео не ретушируются)
                      </p>
                    )}
                    <Button onClick={() => runBatch()} className="w-full gap-2">
                      <Icon name="Sparkles" size={16} />
                      Отретушировать всю папку
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span>
                          Готово {doneCount} из {items.length}
                          {failedIds.length > 0 && <span className="text-destructive"> · ошибок {failedIds.length}</span>}
                        </span>
                        <span className="text-muted-foreground">{Math.round((finishedCount / items.length) * 100)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${(finishedCount / items.length) * 100}%` }} />
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                      {items.map((it) => (
                        <div key={it.id} className="flex items-center gap-2 rounded-lg border border-border p-1.5">
                          {it.thumb ? (
                            <img src={it.thumb} alt="" className="w-10 h-10 rounded object-cover shrink-0" loading="lazy" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted shrink-0 flex items-center justify-center text-[9px] font-semibold text-muted-foreground">RAW</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{it.file_name}</p>
                            <p className={`text-[11px] truncate ${it.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {it.status === 'pending' ? 'В очереди' : it.text}
                            </p>
                          </div>
                          {it.status === 'processing' && <Icon name="Loader2" size={16} className="animate-spin text-primary shrink-0" />}
                          {it.status === 'done' && <Icon name="CheckCircle2" size={16} className="text-green-600 shrink-0" />}
                          {it.status === 'failed' && <Icon name="XCircle" size={16} className="text-destructive shrink-0" />}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {batchRunning ? (
                        <Button variant="outline" onClick={() => { cancelRef.current = true; }} className="gap-1.5">
                          <Icon name="Square" size={14} />
                          Остановить
                        </Button>
                      ) : (
                        <>
                          {failedIds.length > 0 && (
                            <Button variant="outline" onClick={() => runBatch(failedIds)} className="gap-1.5">
                              <Icon name="RefreshCw" size={14} />
                              Повторить ошибки ({failedIds.length})
                            </Button>
                          )}
                          <Button variant="ghost" onClick={() => setItems([])} className="gap-1.5 ml-auto">
                            <Icon name="Plus" size={14} />
                            Новая обработка
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoBankSkinRetouchDialog;
