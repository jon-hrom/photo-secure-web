import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';
import {
  SKIN_RETOUCH_URL,
  PHOTOBANK_URL,
  PresetKey,
  RetouchStage,
  dataUrlToBase64,
  fileToImage,
  imageToDataUrl,
  urlToImage,
} from '@/components/tools/skinRetouch/utils';

export const useRetouchApi = (open: boolean) => {
  const { toast } = useToast();

  const [stage, setStage] = useState<RetouchStage>('upload');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [preset, setPreset] = useState<PresetKey>('medium');
  const [price, setPrice] = useState<number | null>(null);
  const [compare, setCompare] = useState(50);
  const [showPicker, setShowPicker] = useState(false);
  const [showSaver, setShowSaver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [originalUrl, setOriginalUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceNameRef = useRef('photo');
  const estimatedRef = useRef(false);

  const reset = useCallback(() => {
    setStage('upload');
    setLoading(false);
    setLoadingText('');
    setCompare(50);
    setOriginalUrl('');
    setResultUrl('');
    setSaving(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  /** Цена одна на все фото — забираем один раз при первом открытии. */
  useEffect(() => {
    if (!open || estimatedRef.current) return;
    estimatedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`${SKIN_RETOUCH_URL}?action=estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (res.ok) setPrice(data.price ?? null);
      } catch (e) {
        console.error('estimate failed', e);
      }
    })();
  }, [open]);

  /** Основной прогон: ставит задачу, ждёт результат, показывает «до/после». */
  const runRetouch = useCallback(async (sourceDataUrl: string, presetKey: PresetKey) => {
    const userId = getAuthUserId();
    if (!userId) {
      toast({ title: 'Не удалось определить пользователя', variant: 'destructive' });
      return;
    }
    const imageB64 = dataUrlToBase64(sourceDataUrl);
    const headers = { 'Content-Type': 'application/json', 'X-User-Id': String(userId) };

    setLoading(true);
    setLoadingText('Отправляем фото на ретушь...');
    try {
      const res = await fetch(`${SKIN_RETOUCH_URL}?action=start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image: imageB64 }),
      });
      const started = await res.json();

      if (res.status === 402) {
        toast({
          title: 'Не хватает энергии',
          description: `Нужно ${started?.needed ?? '?'} ⚡, на балансе ${started?.energy_balance ?? 0} ⚡.`,
          variant: 'destructive',
        });
        return;
      }
      if (!res.ok || !started?.task_id) throw new Error(started?.error || `HTTP ${res.status}`);

      setLoadingText('AI выравнивает кожу...');

      let data: Record<string, unknown> | null = null;
      // Обрыв соединения на мобильном интернете — норма. Задача на сервере
      // при этом жива, поэтому сетевые ошибки не валят прогон: пробуем снова.
      let networkFails = 0;
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 4000));
        let sd: Record<string, unknown>;
        try {
          const sr = await fetch(`${SKIN_RETOUCH_URL}?action=status`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              task_id: started.task_id,
              image: imageB64,
              preset: presetKey,
            }),
          });
          sd = await sr.json();
          if (!sr.ok) throw new Error((sd?.error as string) || `HTTP ${sr.status}`);
          networkFails = 0;
        } catch (netErr) {
          networkFails += 1;
          console.warn('retouch poll failed', netErr);
          if (networkFails >= 5) throw netErr;
          setLoadingText('Связь оборвалась, повторяем запрос...');
          continue;
        }
        if (sd.status === 'processing') {
          setLoadingText('AI выравнивает кожу...');
          continue;
        }
        if (sd.status === 'refunded') {
          throw new Error((sd.error as string) || 'ретушь не удалась, энергия возвращена');
        }
        if (sd.status === 'failed') throw new Error((sd.error as string) || 'не удалось отретушировать');
        data = sd;
        break;
      }
      if (!data?.image) throw new Error('Превышено время ожидания');

      setResultUrl(`data:image/jpeg;base64,${data.image}`);
      setStage('result');
      setCompare(50);
      toast({
        title: 'Готово',
        description: `Кожа выровнена. Списано ${data.charged} ⚡, осталось ${data.energy_balance ?? '—'} ⚡.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Не удалось отретушировать',
        description: String((e as Error)?.message || e),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  }, [toast]);

  const handleFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setLoadingText('Загружаем фото...');
      const img = await fileToImage(file);
      const dataUrl = imageToDataUrl(img);
      sourceNameRef.current = file.name.replace(/\.[^.]+$/, '') || 'photo';
      setOriginalUrl(dataUrl);
      setLoading(false);
      await runRetouch(dataUrl, preset);
    } catch (e) {
      console.error(e);
      setLoading(false);
      toast({ title: 'Не удалось загрузить фото', variant: 'destructive' });
    }
  }, [preset, runRetouch, toast]);

  const handlePickFromBank = useCallback(async (photo: { s3_url: string; file_name: string }) => {
    setShowPicker(false);
    try {
      setLoading(true);
      setLoadingText('Загружаем фото из фотобанка...');
      const img = await urlToImage(photo.s3_url);
      const dataUrl = imageToDataUrl(img);
      sourceNameRef.current = photo.file_name.replace(/\.[^.]+$/, '') || 'photo';
      setOriginalUrl(dataUrl);
      setLoading(false);
      await runRetouch(dataUrl, preset);
    } catch (e) {
      console.error(e);
      setLoading(false);
      toast({
        title: 'Не удалось загрузить фото',
        description: 'Возможно, фото защищено CORS. Попробуйте загрузить файл с устройства.',
        variant: 'destructive',
      });
    }
  }, [preset, runRetouch, toast]);

  /** Пересчитать с другой силой — платный прогон, поэтому спрашиваем явно. */
  const rerun = useCallback(async (presetKey: PresetKey) => {
    setPreset(presetKey);
    if (!originalUrl) return;
    await runRetouch(originalUrl, presetKey);
  }, [originalUrl, runRetouch]);

  const download = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${sourceNameRef.current}-retouched.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [resultUrl]);

  const handleSaveToFolder = useCallback(async (folder: { id: number; folder_name: string }) => {
    const userId = getAuthUserId();
    if (!userId || !resultUrl) {
      toast({ title: 'Нет готового фото', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      setLoading(true);
      setLoadingText('Сохраняем в фотобанк...');
      const img = await urlToImage(resultUrl);
      const res = await fetch(PHOTOBANK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
        body: JSON.stringify({
          action: 'upload_direct',
          folder_id: folder.id,
          file_name: `${sourceNameRef.current}-retouched-${Date.now()}.jpg`,
          file_data: resultUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
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
      setLoadingText('');
    }
  }, [resultUrl, toast]);

  return {
    stage,
    loading,
    loadingText,
    preset,
    setPreset,
    price,
    compare,
    setCompare,
    showPicker,
    setShowPicker,
    showSaver,
    setShowSaver,
    saving,
    originalUrl,
    resultUrl,
    fileInputRef,
    handleFile,
    handlePickFromBank,
    handleSaveToFolder,
    rerun,
    download,
    reset,
  };
};

export type RetouchState = ReturnType<typeof useRetouchApi>;