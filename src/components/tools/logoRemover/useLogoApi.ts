import { useCallback } from 'react';
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

export const useLogoApi = (s: CanvasState) => {
  const { toast } = useToast();
  const {
    setStage, setLoading, setLoadingText,
    setHasMask, setHistoryLen,
    setShowPicker, setShowSaver, setSaving,
    hasMask,
    originalDataUrlRef, currentDataUrlRef, historyRef,
    imageCanvasRef, maskCanvasRef,
    loadImageIntoCanvas,
  } = s;

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

  const detectAI = useCallback(async () => {
    if (!currentDataUrlRef.current) return;
    try {
      setLoading(true);
      setLoadingText('AI ищет логотип...');
      const res = await fetch(`${LOGO_REMOVE_URL}?action=detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrlToBase64(currentDataUrlRef.current) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const maskB64 = data.mask;
      if (!maskB64) throw new Error('AI не вернул маску');

      const mImg = new Image();
      await new Promise<void>((resolve, reject) => {
        mImg.onload = () => resolve();
        mImg.onerror = (e) => reject(e);
        mImg.src = `data:image/png;base64,${maskB64}`;
      });

      const mask = maskCanvasRef.current!;
      const mctx = mask.getContext('2d')!;
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
      mctx.drawImage(tmp, 0, 0);
      setHasMask(true);

      const total = (data.ocr_pixels || 0) + (data.yolo_pixels || 0);
      if (total === 0) {
        toast({ title: 'AI не нашёл лого', description: 'Выделите область кистью вручную' });
      } else {
        toast({ title: 'Лого найдено', description: 'Проверьте выделение и нажмите «Стереть»' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка AI-детекции', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inpaint = useCallback(async () => {
    if (!hasMask || !currentDataUrlRef.current) {
      toast({ title: 'Сначала выделите область', description: 'Кисть или «Найти AI»' });
      return;
    }
    try {
      setLoading(true);
      setLoadingText('Стираем лого...');

      const mask = maskCanvasRef.current!;
      const bw = document.createElement('canvas');
      bw.width = mask.width;
      bw.height = mask.height;
      const bwCtx = bw.getContext('2d')!;
      const src = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height);
      const dst = bwCtx.createImageData(mask.width, mask.height);
      for (let i = 0; i < src.data.length; i += 4) {
        const a = src.data[i + 3];
        const v = a > 10 ? 255 : 0;
        dst.data[i] = v;
        dst.data[i + 1] = v;
        dst.data[i + 2] = v;
        dst.data[i + 3] = 255;
      }
      bwCtx.putImageData(dst, 0, 0);
      const maskB64 = dataUrlToBase64(bw.toDataURL('image/png'));

      const res = await fetch(`${LOGO_REMOVE_URL}?action=inpaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrlToBase64(currentDataUrlRef.current),
          mask: maskB64,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.image) throw new Error(data?.error || `HTTP ${res.status}`);

      const resultDataUrl = `data:image/png;base64,${data.image}`;
      historyRef.current.push(resultDataUrl);
      setHistoryLen(historyRef.current.length);
      await loadImageIntoCanvas(resultDataUrl);
      toast({ title: 'Готово', description: 'Лого удалено. Можно продолжить или скачать.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка при стирании', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [hasMask, loadImageIntoCanvas, toast, setLoading, setLoadingText, setHistoryLen, currentDataUrlRef, historyRef, maskCanvasRef]);

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
    detectAI,
    inpaint,
    undo,
    download,
  };
};
