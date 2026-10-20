import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';
import { addToHistory } from '@/lib/toolsHistory';
import { saveBlobToPhotoBank } from '@/components/tools/saveToPhotoBank';
import {
  SourceImage, loadSourceFromFile, loadSourceFromUrl, canvasToBlob, copyJpegMeta, downloadBlob, mimeFromName,
} from '@/components/tools/objectRemover/fullRes';
import { composeUpscale, targetSize, UpscalePlace } from '@/components/tools/upscale/composeUpscale';
import { composeStable } from '@/components/tools/upscale/composeStable';

export const UPSCALE_URL = 'https://functions.poehali.dev/c015dc93-c17d-41f0-a0b7-ba0014b5d997';

export type UpscaleSize = 'orig' | '2k' | '4k' | '8k';
export type Stage = 'upload' | 'edit';

const SEND_MAX_SIDE = 2048;

const toUrlImage = (src: string, cors = false): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('не удалось загрузить изображение'));
    img.src = src;
  });

/** JPEG для отправки модели (длинная сторона ≤ 2048, остальное не трогаем). */
const sourceToJpegB64 = (img: HTMLImageElement) => {
  const k = Math.min(1, SEND_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.95);
  c.width = 0;
  return url.split(',')[1] || '';
};

const upscaledName = (name: string, size: UpscaleSize, mime: string) => {
  const base = name.replace(/\.[^.]+$/, '');
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  return `${base}_${size === 'orig' ? 'STAB' : size.toUpperCase()}.${ext}`;
};

export const useUpscaleApi = (open: boolean) => {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('upload');
  const [size, setSize] = useState<UpscaleSize>('4k');
  const [stabilize, setStabilize] = useState<boolean>(() => localStorage.getItem('upscale_stabilize') !== '0');
  useEffect(() => {
    localStorage.setItem('upscale_stabilize', stabilize ? '1' : '0');
  }, [stabilize]);
  const [prices, setPrices] = useState<Record<UpscaleSize, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultInfo, setResultInfo] = useState<{ width: number; height: number; size: UpscaleSize } | null>(null);
  const [compare, setCompare] = useState(50);
  const [showPicker, setShowPicker] = useState(false);
  const [showSaver, setShowSaver] = useState(false);
  const [saving, setSaving] = useState(false);
  const srcRef = useRef<SourceImage | null>(null);
  const resultBlobRef = useRef<{ blob: Blob; name: string; width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${UPSCALE_URL}?action=estimate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => r.json())
      .then((d) => d?.prices && setPrices(d.prices))
      .catch(() => undefined);
  }, []);

  const clearResult = useCallback(() => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl('');
    setResultInfo(null);
    resultBlobRef.current = null;
  }, [resultUrl]);

  const resetAll = useCallback(() => {
    clearResult();
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    setOriginalUrl('');
    srcRef.current = null;
    setStage('upload');
    setCompare(50);
  }, [clearResult, originalUrl]);

  useEffect(() => {
    if (!open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startWith = useCallback((src: SourceImage) => {
    clearResult();
    srcRef.current = src;
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    const c = document.createElement('canvas');
    c.width = src.img.naturalWidth;
    c.height = src.img.naturalHeight;
    c.getContext('2d')!.drawImage(src.img, 0, 0);
    c.toBlob((b) => {
      if (b) setOriginalUrl(URL.createObjectURL(b));
      c.width = 0;
    }, 'image/jpeg', 0.92);
    setStage('edit');
    const longSide = Math.max(src.img.naturalWidth, src.img.naturalHeight);
    setSize(longSide >= 3500 ? '8k' : longSide >= 1800 ? '4k' : '2k');
  }, [clearResult, originalUrl]);

  const handleFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setLoadingText('Загружаем фото...');
      startWith(await loadSourceFromFile(file));
    } catch {
      toast({ title: 'Не удалось загрузить фото', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [startWith, toast]);

  const handlePickFromBank = useCallback(async (photo: { s3_url: string; file_name: string }) => {
    setShowPicker(false);
    try {
      setLoading(true);
      setLoadingText('Загружаем фото из фотобанка...');
      startWith(await loadSourceFromUrl(photo.s3_url, photo.file_name));
    } catch {
      toast({ title: 'Не удалось загрузить фото', description: 'Попробуйте скачать фото и загрузить файлом.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [startWith, toast]);

  const upscale = useCallback(async () => {
    const src = srcRef.current;
    if (!src) return;
    const { width, height } = targetSize(src.img.naturalWidth, src.img.naturalHeight, size);
    if (size !== 'orig' && width <= src.img.naturalWidth) {
      toast({ title: 'Фото уже больше выбранного размера', description: 'Выберите разрешение побольше.' });
      return;
    }
    const userId = getAuthUserId();
    const headers = { 'Content-Type': 'application/json', ...(userId ? { 'X-User-Id': String(userId) } : {}) };
    try {
      setLoading(true);
      setLoadingText('Отправляем фото...');
      clearResult();
      const res = await fetch(`${UPSCALE_URL}?action=start`, {
        method: 'POST', headers, body: JSON.stringify({
          size, image: sourceToJpegB64(src.img), orig_side: Math.max(src.img.naturalWidth, src.img.naturalHeight),
        }),
      }).catch(() => null);
      if (!res || res.status === 504) {
        throw new Error('AI-сервис долго не отвечал, запуск сорвался. Энергия не списана — попробуйте ещё раз через минуту.');
      }
      const started = await res.json().catch(() => ({}));
      if (res.status === 402) {
        toast({
          title: 'Не хватает энергии',
          description: `Нужно ${started?.needed ?? '?'} ⚡, на балансе ${started?.energy_balance ?? 0} ⚡. Пополните баланс в шапке.`,
          variant: 'destructive',
        });
        return;
      }
      if (!res.ok || !started?.task_id) throw new Error(started?.error || `HTTP ${res.status}`);

      setLoadingText('AI повышает чёткость деталей...');
      let data: { status: string; url?: string; place?: UpscalePlace; error?: string; charged?: number; energy_balance?: number } | null = null;
      let fails = 0;
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const sr = await fetch(`${UPSCALE_URL}?action=status`, {
          method: 'POST', headers, body: JSON.stringify({ task_id: started.task_id, size, input_key: started.input_key }),
        }).catch(() => null);
        if (!sr || sr.status >= 500) {
          if (fails < 5) { fails += 1; setLoadingText('Собираем результат...'); continue; }
          throw new Error('Сервер не успел собрать результат. Попробуйте ещё раз через минуту.');
        }
        const sd = await sr.json().catch(() => ({}));
        if (!sr.ok) throw new Error(sd?.error || `HTTP ${sr.status}`);
        fails = 0;
        if (sd.status === 'processing') continue;
        if (sd.status === 'failed') throw new Error(`${sd.error || 'не удалось увеличить'}${sd.refunded ? '. Энергия возвращена' : ''}`);
        data = sd;
        break;
      }
      if (!data?.url || !data.place) throw new Error('Превышено время ожидания');

      setLoadingText('Собираем фото в исходных цветах...');
      const aiImg = await toUrlImage(data.url, true);
      if (stabilize) setLoadingText('Стабилизация: выравниваем детали...');
      const onProgress = (p: number) => setLoadingText(`Собираем фото ${width}×${height}... ${Math.round(p * 100)}%`);
      const canvas = stabilize || size === 'orig'
        ? await composeStable(src.img, aiImg, data.place, width, height, onProgress)
        : await composeUpscale(src.img, aiImg, data.place, width, height, onProgress);
      setLoadingText('Готовим файл...');
      const mime = mimeFromName(src.name) === 'image/png' ? 'image/png' : 'image/jpeg';
      let blob = await canvasToBlob(canvas, mime, 0.95);
      if (mime === 'image/jpeg') blob = await copyJpegMeta(src.bytes, blob);
      canvas.width = 0;
      canvas.height = 0;
      const name = upscaledName(src.name, size, mime);
      resultBlobRef.current = { blob, name, width, height };
      setResultUrl(URL.createObjectURL(blob));
      setResultInfo({ width, height, size });
      setCompare(50);
      if (size !== '8k') {
        const reader = new FileReader();
        reader.onload = () => addToHistory({ tool: 'upscale', image: String(reader.result) });
        reader.readAsDataURL(blob);
      }
      toast({
        title: 'Готово',
        description: `Фото ${width}×${height}. Списано ${data.charged} ⚡, осталось ${data.energy_balance ?? '—'} ⚡.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось увеличить разрешение', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [size, stabilize, toast, clearResult]);

  const download = useCallback(async () => {
    const r = resultBlobRef.current;
    if (r) await downloadBlob(r.blob, r.name);
  }, []);

  const handleSaveToFolder = useCallback(async (folder: { id: number; folder_name: string }) => {
    const r = resultBlobRef.current;
    const userId = getAuthUserId();
    if (!r || !userId) return;
    try {
      setSaving(true);
      setLoading(true);
      setLoadingText('Сохраняем в фотобанк...');
      await saveBlobToPhotoBank({ userId, folderId: folder.id, blob: r.blob, fileName: r.name, width: r.width, height: r.height });
      toast({ title: 'Сохранено', description: `Фото загружено в «${folder.folder_name}»` });
      setShowSaver(false);
    } catch (e) {
      toast({ title: 'Не удалось сохранить', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }, [toast]);

  return {
    stage, size, setSize, stabilize, setStabilize, prices, loading, loadingText, originalUrl, resultUrl, resultInfo,
    compare, setCompare, showPicker, setShowPicker, showSaver, setShowSaver, saving, fileInputRef,
    source: srcRef.current, handleFile, handlePickFromBank, upscale, download, handleSaveToFolder, resetAll,
  };
};
