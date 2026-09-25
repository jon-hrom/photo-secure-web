import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';
import {
  PHOTOBANK_URL,
  urlToImage,
  fileToImage,
  dataUrlToBase64,
  imageToDataUrl,
} from '@/components/tools/logoRemover/utils';
import { CanvasState } from '@/components/tools/logoRemover/useCanvasState';
import { buildInpaintMask } from '@/components/tools/logoRemover/maskAnalysis';

export const OBJECT_REMOVE_URL = 'https://functions.poehali.dev/61d4064f-fce9-47b5-bfa8-0704146ff165';

export const useObjectApi = (s: CanvasState) => {
  const { toast } = useToast();
  const {
    setStage, setLoading, setLoadingText, setHistoryLen,
    setShowPicker, setShowSaver, setSaving,
    setEstimate, setEstimating,
    hasMask, originalDataUrlRef, currentDataUrlRef, historyRef,
    imageCanvasRef, maskCanvasRef, loadImageIntoCanvas,
  } = s;
  const estimateLoaded = useRef(false);

  const startWith = useCallback(async (img: HTMLImageElement) => {
    const dataUrl = imageToDataUrl(img, 'image/jpeg');
    originalDataUrlRef.current = dataUrl;
    historyRef.current = [dataUrl];
    setHistoryLen(1);
    setStage('edit');
    await new Promise((r) => setTimeout(r, 50));
    await loadImageIntoCanvas(dataUrl);
  }, [loadImageIntoCanvas, originalDataUrlRef, historyRef, setHistoryLen, setStage]);

  const handleFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setLoadingText('Загружаем фото...');
      await startWith(await fileToImage(file));
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось загрузить фото', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [startWith, toast, setLoading, setLoadingText]);

  const handlePickFromBank = useCallback(async (photo: { s3_url: string; file_name: string }) => {
    setShowPicker(false);
    try {
      setStage('edit');
      setLoading(true);
      setLoadingText('Загружаем фото из фотобанка...');
      await startWith(await urlToImage(photo.s3_url));
    } catch (e) {
      console.error(e);
      toast({
        title: 'Не удалось загрузить фото',
        description: 'Попробуйте скачать фото и загрузить файлом.',
        variant: 'destructive',
      });
      setStage('upload');
    } finally {
      setLoading(false);
    }
  }, [startWith, toast, setShowPicker, setStage, setLoading, setLoadingText]);

  const handleSaveToFolder = useCallback(async (folder: { id: number; folder_name: string }) => {
    const userId = getAuthUserId();
    const canvas = imageCanvasRef.current;
    if (!userId || !canvas) {
      toast({ title: 'Не удалось определить пользователя', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      setLoading(true);
      setLoadingText('Сохраняем в фотобанк...');
      const res = await fetch(PHOTOBANK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          action: 'upload_direct',
          folder_id: folder.id,
          file_name: `object-removed-${Date.now()}.jpg`,
          file_data: canvas.toDataURL('image/jpeg', 0.92),
          width: canvas.width,
          height: canvas.height,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast({ title: 'Сохранено', description: `Фото загружено в «${folder.folder_name}»` });
      setShowSaver(false);
    } catch (e) {
      toast({ title: 'Не удалось сохранить', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }, [toast, imageCanvasRef, setSaving, setLoading, setLoadingText, setShowSaver]);

  useEffect(() => {
    if (estimateLoaded.current) return;
    estimateLoaded.current = true;
    setEstimating(true);
    fetch(`${OBJECT_REMOVE_URL}?action=estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.json())
      .then((d) => d?.price && setEstimate(d))
      .catch(() => undefined)
      .finally(() => setEstimating(false));
  }, [setEstimate, setEstimating]);

  const removeObjects = useCallback(async () => {
    if (!hasMask || !currentDataUrlRef.current) {
      toast({ title: 'Сначала выделите объект', description: 'Закрасьте кистью то, что нужно убрать с фото' });
      return;
    }
    const userId = getAuthUserId();
    const headers = { 'Content-Type': 'application/json', ...(userId ? { 'X-User-Id': String(userId) } : {}) };
    const maskB64 = buildInpaintMask(maskCanvasRef.current!, 4, 2);
    const imageB64 = dataUrlToBase64(currentDataUrlRef.current);

    try {
      setLoading(true);
      setLoadingText('Отправляем фото...');
      const res = await fetch(`${OBJECT_REMOVE_URL}?action=inpaint`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image: imageB64, mask: maskB64 }),
      });
      const started = await res.json();
      if (res.status === 402) {
        toast({
          title: 'Не хватает энергии',
          description: `Нужно ${started?.needed ?? '?'} ⚡, на балансе ${started?.energy_balance ?? 0} ⚡. Пополните баланс в шапке.`,
          variant: 'destructive',
        });
        return;
      }
      if (!res.ok || !started?.task_id) throw new Error(started?.error || `HTTP ${res.status}`);

      setLoadingText('AI дорисовывает фон...');
      let taskId: string = started.task_id;
      let model: string | undefined = started.model;
      let data: Record<string, unknown> | null = null;
      for (let i = 0; i < 75; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const sr = await fetch(`${OBJECT_REMOVE_URL}?action=status`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ task_id: taskId, model, image: imageB64, mask: maskB64 }),
        });
        const sd = await sr.json();
        if (!sr.ok) throw new Error(sd?.error || `HTTP ${sr.status}`);
        if (sd.status === 'processing') {
          if (sd.task_id) {
            taskId = sd.task_id;
            model = sd.model;
          }
          continue;
        }
        if (sd.status === 'failed') throw new Error(sd.error || 'не удалось удалить объект');
        data = sd;
        break;
      }
      if (!data?.image) throw new Error('Превышено время ожидания');

      const resultDataUrl = `data:image/jpeg;base64,${data.image}`;
      historyRef.current.push(resultDataUrl);
      setHistoryLen(historyRef.current.length);
      await loadImageIntoCanvas(resultDataUrl);
      toast({
        title: 'Готово',
        description: `Объект удалён. Списано ${data.charged} ⚡, осталось ${data.energy_balance ?? '—'} ⚡.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось удалить объект', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [hasMask, currentDataUrlRef, maskCanvasRef, historyRef, loadImageIntoCanvas, toast, setLoading, setLoadingText, setHistoryLen]);

  const undo = useCallback(async () => {
    if (historyRef.current.length < 2) return;
    historyRef.current.pop();
    setHistoryLen(historyRef.current.length);
    await loadImageIntoCanvas(historyRef.current[historyRef.current.length - 1]);
    toast({ title: 'Отменено' });
  }, [loadImageIntoCanvas, toast, setHistoryLen, historyRef]);

  const download = useCallback(() => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.95);
    a.download = `object-removed-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [imageCanvasRef]);

  return { handleFile, handlePickFromBank, handleSaveToFolder, removeObjects, undo, download };
};
