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

      // Обрыв соединения на мобильном интернете — норма. Задача на сервере
      // при этом жива, поэтому сетевые ошибки не валят прогон: пробуем снова.
      let networkFails = 0;
      let gaveUpOnNetwork = false;
      // Сервер может перезапустить задачу на запасной модели (если основная
      // отклонила фото по модерации) — тогда он вернёт новый task_id.
      let taskId = started.task_id as string;
      let retried = false;
      let readyUrl = '';
      // Очередь у провайдера в час пик растягивается, и прежние 4 минуты
      // обрывали ретушь, которая была уже почти готова. Ждём до 12 минут,
      // после первой минуты опрашивая реже, чтобы не долбить функцию.
      const startedAt = Date.now();
      const MAX_WAIT_MS = 12 * 60 * 1000;
      while (Date.now() - startedAt < MAX_WAIT_MS) {
        const waited = Date.now() - startedAt;
        await new Promise((r) => setTimeout(r, waited < 60000 ? 4000 : 8000));
        const mins = Math.floor((Date.now() - startedAt) / 60000);
        let sd: Record<string, unknown>;
        try {
          const sr = await fetch(`${SKIN_RETOUCH_URL}?action=status`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              task_id: taskId,
              image: imageB64,
              preset: presetKey,
              retried,
            }),
          });
          sd = await sr.json();
          if (!sr.ok) throw new Error((sd?.error as string) || `HTTP ${sr.status}`);
          networkFails = 0;
        } catch (netErr) {
          networkFails += 1;
          console.warn('retouch poll failed', netErr);
          // Связь окончательно потеряна. Не бросаем ошибку сразу: выходим из
          // цикла в общий путь завершения, который вернёт энергию за задачу.
          if (networkFails >= 8) {
            gaveUpOnNetwork = true;
            break;
          }
          setLoadingText('Связь оборвалась, повторяем запрос...');
          continue;
        }
        if (sd.status === 'processing') {
          if (sd.task_id && sd.task_id !== taskId) {
            taskId = sd.task_id as string;
            retried = true;
            setLoadingText('Подбираем другую модель...');
          } else {
            setLoadingText(
              mins >= 1
                ? `AI выравнивает кожу... очередь загружена, ждём ${mins} мин`
                : 'AI выравнивает кожу...',
            );
          }
          continue;
        }
        if (sd.status === 'refunded') {
          throw new Error((sd.error as string) || 'ретушь не удалась, энергия возвращена');
        }
        if (sd.status === 'failed') throw new Error((sd.error as string) || 'не удалось отретушировать');
        readyUrl = String(sd.url || '');
        break;
      }
      if (!readyUrl) {
        // Ждать дальше бессмысленно, но энергия уже списана. Просим сервер
        // закрыть задачу: если результат подоспел — заберём его, если нет —
        // он вернёт 15 ⚡ обратно, чтобы ожидание не стоило пользователю денег.
        try {
          const ar = await fetch(`${SKIN_RETOUCH_URL}?action=abandon`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ task_id: taskId }),
          });
          const ad = await ar.json();
          if (ad?.status === 'ready' && ad.url) {
            readyUrl = String(ad.url);
          } else {
            const cause = gaveUpOnNetwork
              ? 'Пропала связь с сервером'
              : 'Сервис ретуши не ответил за 12 минут';
            throw new Error(
              ad?.refunded
                ? `${cause}. Энергия возвращена — попробуйте ещё раз.`
                : `${cause}. Попробуйте ещё раз.`,
            );
          }
        } catch (abandonErr) {
          if (readyUrl) {
            // результат всё-таки пришёл — идём дальше
          } else {
            throw abandonErr instanceof Error
              ? abandonErr
              : new Error('Сервис ретуши не ответил за 12 минут.');
          }
        }
      }

      // Второй шаг: сборка финального кадра. Вынесена в отдельный запрос,
      // потому что вместе с ожиданием модели она не укладывалась в лимит
      // времени функции и готовая ретушь срывалась по таймауту.
      setLoadingText('Собираем результат...');
      let data: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const cr = await fetch(`${SKIN_RETOUCH_URL}?action=compose`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url: readyUrl, image: imageB64, preset: presetKey }),
          });
          const cd = await cr.json();
          if (!cr.ok) throw new Error((cd?.error as string) || `HTTP ${cr.status}`);
          if (cd.status === 'failed') throw new Error((cd.error as string) || 'не удалось собрать результат');
          data = cd;
          break;
        } catch (composeErr) {
          if (attempt === 2) throw composeErr;
          console.warn('retouch compose failed, retrying', composeErr);
          setLoadingText('Повторяем сборку...');
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (!data?.image) throw new Error('Не удалось собрать результат');

      setResultUrl(`data:image/jpeg;base64,${data.image}`);
      setStage('result');
      setCompare(50);
      toast({
        title: 'Готово',
        description: `Кожа выровнена. Списано ${data.charged} ⚡, осталось ${data.energy_balance ?? '—'} ⚡.`,
      });
    } catch (e) {
      console.error(e);
      const raw = String((e as Error)?.message || e);
      // Текст модерации приходит от провайдера по-английски и пугает.
      const friendly = /sensitive content/i.test(raw)
        ? 'Сервис ретуши отклонил это фото фильтром безопасности. Попробуйте другой кадр или обрежьте фото поближе к лицу. Энергия возвращена.'
        : raw;
      toast({
        title: 'Не удалось отретушировать',
        description: friendly,
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