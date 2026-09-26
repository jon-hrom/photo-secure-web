import { useCallback, useEffect, useRef, useState } from 'react';
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

export const FACE_SWAP_URL = 'https://functions.poehali.dev/ebf5f521-be34-42d2-a0f8-1424c0b4b494';

export type SwapStep = 'donor' | 'target';

/** Загрузка фото в конкретный редактор (донора или целевой). */
const useLoader = (s: CanvasState) => {
  const { toast } = useToast();
  const { setStage, setLoading, setLoadingText, setHistoryLen, setShowPicker,
    originalDataUrlRef, historyRef, loadImageIntoCanvas } = s;

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
      toast({ title: 'Не удалось загрузить фото', description: 'Попробуйте скачать фото и загрузить файлом.', variant: 'destructive' });
      setStage('upload');
    } finally {
      setLoading(false);
    }
  }, [startWith, toast, setShowPicker, setStage, setLoading, setLoadingText]);

  return { handleFile, handlePickFromBank };
};

export const useFaceSwapApi = (donor: CanvasState, target: CanvasState, open: boolean) => {
  const { toast } = useToast();
  const [step, setStep] = useState<SwapStep>('donor');
  const [price, setPrice] = useState(30);
  const estimateLoaded = useRef(false);
  const donorLoader = useLoader(donor);
  const targetLoader = useLoader(target);

  useEffect(() => {
    if (!open) setStep('donor');
  }, [open]);

  useEffect(() => {
    if (estimateLoaded.current) return;
    estimateLoaded.current = true;
    fetch(`${FACE_SWAP_URL}?action=estimate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => r.json())
      .then((d) => d?.price && setPrice(d.price))
      .catch(() => undefined);
  }, []);

  const goToTarget = useCallback(() => {
    if (!donor.hasMask) {
      toast({ title: 'Закрасьте лицо донора', description: 'Проведите кистью по лицу, которое нужно перенести' });
      return;
    }
    setStep('target');
  }, [donor.hasMask, toast]);

  const swap = useCallback(async () => {
    if (!donor.hasMask || !donor.currentDataUrlRef.current) {
      setStep('donor');
      toast({ title: 'Сначала отметьте лицо на фото-доноре' });
      return;
    }
    if (!target.hasMask || !target.currentDataUrlRef.current) {
      toast({ title: 'Закрасьте лицо, которое нужно заменить', description: 'Проведите кистью по лицу на этом фото' });
      return;
    }
    const userId = getAuthUserId();
    const headers = { 'Content-Type': 'application/json', ...(userId ? { 'X-User-Id': String(userId) } : {}) };
    const payload = {
      donor: dataUrlToBase64(donor.currentDataUrlRef.current),
      donor_mask: buildInpaintMask(donor.maskCanvasRef.current!, 2, 0),
      target: dataUrlToBase64(target.currentDataUrlRef.current),
      target_mask: buildInpaintMask(target.maskCanvasRef.current!, 2, 0),
    };
    const { setLoading, setLoadingText, historyRef, setHistoryLen, loadImageIntoCanvas } = target;

    try {
      setLoading(true);
      setLoadingText('Отправляем фото...');
      const res = await fetch(`${FACE_SWAP_URL}?action=swap`, { method: 'POST', headers, body: JSON.stringify(payload) });
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

      setLoadingText('AI переносит лицо...');
      let taskId: string = started.task_id;
      let model: string | undefined = started.model;
      let attempt = 1;
      let data: Record<string, unknown> | null = null;
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const sr = await fetch(`${FACE_SWAP_URL}?action=status`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ task_id: taskId, model, attempt, ...payload }),
        });
        const sd = await sr.json();
        if (!sr.ok) throw new Error(sd?.error || `HTTP ${sr.status}`);
        if (sd.status === 'processing') {
          if (sd.task_id) {
            taskId = sd.task_id;
            model = sd.model;
            if (sd.attempt) {
              attempt = Number(sd.attempt);
              setLoadingText('Лицо не изменилось — пробуем ещё раз...');
            }
          }
          continue;
        }
        if (sd.status === 'failed') throw new Error(sd.error || 'не удалось перенести лицо');
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
        description: `Лицо перенесено. Списано ${data.charged} ⚡, осталось ${data.energy_balance ?? '—'} ⚡.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось перенести лицо', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [donor, target, toast]);

  const undo = useCallback(async () => {
    const { historyRef, setHistoryLen, loadImageIntoCanvas } = target;
    if (historyRef.current.length < 2) return;
    historyRef.current.pop();
    setHistoryLen(historyRef.current.length);
    await loadImageIntoCanvas(historyRef.current[historyRef.current.length - 1]);
    toast({ title: 'Отменено' });
  }, [target, toast]);

  const download = useCallback(() => {
    const canvas = target.imageCanvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.95);
    a.download = `face-swap-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [target.imageCanvasRef]);

  const handleSaveToFolder = useCallback(async (folder: { id: number; folder_name: string }) => {
    const userId = getAuthUserId();
    const canvas = target.imageCanvasRef.current;
    const { setSaving, setLoading, setLoadingText, setShowSaver } = target;
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
          file_name: `face-swap-${Date.now()}.jpg`,
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
  }, [target, toast]);

  const resetAll = useCallback(() => {
    donor.resetAll();
    target.resetAll();
    setStep('donor');
  }, [donor, target]);

  return { step, setStep, price, donorLoader, targetLoader, goToTarget, swap, undo, download, handleSaveToFolder, resetAll };
};