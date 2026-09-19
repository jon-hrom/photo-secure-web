import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';
import {
  LOGO_REMOVE_URL,
  PHOTOBANK_URL,
  urlToImage,
  fileToImage,
  dataUrlToBase64,
  imageToDataUrl,
} from '@/components/tools/logoRemover/utils';
import { CanvasState } from '@/components/tools/logoRemover/useCanvasState';
import { buildInpaintMask } from '@/components/tools/logoRemover/maskAnalysis';

export const useLogoApi = (s: CanvasState) => {
  const { toast } = useToast();
  const {
    setStage, setLoading, setLoadingText,
    setHasMask, setHistoryLen,
    setShowPicker, setShowSaver, setSaving,
    setEstimate, setEstimating,
    hasMask, bumpMask,
    originalDataUrlRef, currentDataUrlRef, historyRef,
    imageCanvasRef, maskCanvasRef,
    loadImageIntoCanvas,
  } = s;

  const estimateSeq = useRef(0);

  const handleFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setLoadingText('Загружаем фото...');
      const img = await fileToImage(file);
      const dataUrl = imageToDataUrl(img, 'image/jpeg');
      originalDataUrlRef.current = dataUrl;
      historyRef.current = [dataUrl];
      setHistoryLen(1);
      setStage('edit');
      await new Promise((r) => setTimeout(r, 50));
      await loadImageIntoCanvas(dataUrl);
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось загрузить фото', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [loadImageIntoCanvas, toast, setLoading, setLoadingText, setHistoryLen, setStage, originalDataUrlRef, historyRef]);

  const handlePickFromBank = useCallback(async (photo: { s3_url: string; file_name: string }) => {
    setShowPicker(false);
    try {
      setStage('edit');
      setLoading(true);
      setLoadingText('Загружаем фото из фотобанка...');
      await new Promise((r) => setTimeout(r, 50));
      const img = await urlToImage(photo.s3_url);
      const dataUrl = imageToDataUrl(img, 'image/jpeg');
      originalDataUrlRef.current = dataUrl;
      historyRef.current = [dataUrl];
      setHistoryLen(1);
      await loadImageIntoCanvas(dataUrl);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Не удалось загрузить фото',
        description: 'Возможно, фото защищено CORS. Попробуйте скачать и загрузить файл.',
        variant: 'destructive',
      });
      setStage('upload');
    } finally {
      setLoading(false);
    }
  }, [loadImageIntoCanvas, toast, setShowPicker, setStage, setLoading, setLoadingText, setHistoryLen, originalDataUrlRef, historyRef]);

  const handleSaveToFolder = useCallback(async (folder: { id: number; folder_name: string }) => {
    const userId = getAuthUserId();
    if (!userId) {
      toast({ title: 'Не удалось определить пользователя', variant: 'destructive' });
      return;
    }
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    try {
      setSaving(true);
      setLoading(true);
      setLoadingText('Сохраняем в фотобанк...');
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const fileName = `logo-removed-${Date.now()}.jpg`;
      const res = await fetch(PHOTOBANK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          action: 'upload_direct',
          folder_id: folder.id,
          file_name: fileName,
          file_data: dataUrl,
          width: canvas.width,
          height: canvas.height,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast({ title: 'Сохранено', description: `Фото загружено в «${folder.folder_name}»` });
      setShowSaver(false);
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось сохранить', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }, [toast, imageCanvasRef, setSaving, setLoading, setLoadingText, setShowSaver]);

  /** Цена стирания одна на все фото — забираем её один раз при открытии редактора. */
  useEffect(() => {
    if (estimateSeq.current) return;
    estimateSeq.current = 1;
    setEstimating(true);
    (async () => {
      try {
        const res = await fetch(`${LOGO_REMOVE_URL}?action=estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (res.ok) setEstimate(data);
      } catch (e) {
        console.error('estimate failed', e);
      } finally {
        setEstimating(false);
      }
    })();
  }, [setEstimate, setEstimating]);

  /** Просит AI найти лого и закрашивает найденное на холсте. Возвращает число знаков. */
  const runDetect = useCallback(async (): Promise<number> => {
    const res = await fetch(`${LOGO_REMOVE_URL}?action=detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrlToBase64(currentDataUrlRef.current) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    if (!data.mask) throw new Error('AI не вернул маску');

    const mImg = new Image();
    await new Promise<void>((resolve, reject) => {
      mImg.onload = () => resolve();
      mImg.onerror = (e) => reject(e);
      mImg.src = `data:image/png;base64,${data.mask}`;
    });

    const mask = maskCanvasRef.current!;
    const tmp = document.createElement('canvas');
    tmp.width = mask.width;
    tmp.height = mask.height;
    const tctx = tmp.getContext('2d')!;
    tctx.drawImage(mImg, 0, 0, mask.width, mask.height);
    const imgData = tctx.getImageData(0, 0, tmp.width, tmp.height);
    const px = imgData.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 128) {
        px[i] = 236;
        px[i + 1] = 72;
        px[i + 2] = 153;
        px[i + 3] = 140;
      } else {
        px[i + 3] = 0;
      }
    }
    tctx.putImageData(imgData, 0, 0);
    mask.getContext('2d')!.drawImage(tmp, 0, 0);

    if (data.boxes > 0) {
      setHasMask(true);
      bumpMask();
    }
    return data.boxes || 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Отправляет выделенное на стирание и дожидается результата. */
  const runErase = useCallback(async () => {
    const maskB64 = buildInpaintMask(maskCanvasRef.current!);
    const imageB64 = dataUrlToBase64(currentDataUrlRef.current);
    const userId = getAuthUserId();
    const authHeaders = {
      'Content-Type': 'application/json',
      ...(userId ? { 'X-User-Id': String(userId) } : {}),
    };

    const res = await fetch(`${LOGO_REMOVE_URL}?action=inpaint`, {
      method: 'POST',
      headers: authHeaders,
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

    setLoadingText('AI дорисовывает фото...');
    let data: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 4000));
      const sr = await fetch(`${LOGO_REMOVE_URL}?action=status`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ task_id: started.task_id, image: imageB64, mask: maskB64 }),
      });
      const sd = await sr.json();
      if (!sr.ok) throw new Error(sd?.error || `HTTP ${sr.status}`);
      if (sd.status === 'processing') continue;
      if (sd.status === 'failed') throw new Error(sd.error || 'не удалось убрать лого');
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
      description: `Лого убрано. Списано ${data.charged} ⚡, осталось ${data.energy_balance ?? '—'} ⚡.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadImageIntoCanvas, toast, setLoadingText, setHistoryLen]);

  /** Главная кнопка: находит лого и сразу стирает — без лишних шагов. */
  const autoRemove = useCallback(async () => {
    if (!currentDataUrlRef.current) return;
    try {
      setLoading(true);
      setLoadingText('Ищем лого на фото...');
      const found = await runDetect();
      if (!found) {
        toast({
          title: 'Лого не найдено',
          description: 'Закрасьте нужное место кистью и нажмите «Стереть выделенное»',
        });
        return;
      }
      setLoadingText(found > 1 ? `Найдено знаков: ${found}. Убираем...` : 'Лого найдено. Убираем...');
      await runErase();
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось убрать лого', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [runDetect, runErase, toast, setLoading, setLoadingText, currentDataUrlRef]);

  /** Стирание того, что пользователь закрасил кистью сам. */
  const inpaint = useCallback(async () => {
    if (!hasMask || !currentDataUrlRef.current) {
      toast({ title: 'Сначала выделите область', description: 'Закрасьте лого кистью' });
      return;
    }
    try {
      setLoading(true);
      setLoadingText('Стираем лого...');
      await runErase();
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка при стирании', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [hasMask, runErase, toast, setLoading, setLoadingText, currentDataUrlRef]);

  const undo = useCallback(async () => {
    if (historyRef.current.length < 2) return;
    historyRef.current.pop();
    setHistoryLen(historyRef.current.length);
    const prev = historyRef.current[historyRef.current.length - 1];
    await loadImageIntoCanvas(prev);
    toast({ title: 'Отменено' });
  }, [loadImageIntoCanvas, toast, setHistoryLen, historyRef]);

  const download = useCallback(() => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `logo-removed-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [imageCanvasRef]);

  return {
    handleFile,
    handlePickFromBank,
    handleSaveToFolder,
    autoRemove,
    inpaint,
    undo,
    download,
  };
};