import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const YANDEX_DISK_URL = 'https://functions.poehali.dev/e4f749e4-5c96-48dd-9787-17c4179176bb';
const BATCH_SIZE = 15;

export function useYandexDisk(code?: string) {
  const [savingToYandexDisk, setSavingToYandexDisk] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [pendingSubfolderId, setPendingSubfolderId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressDone, setProgressDone] = useState(0);
  const [authUrl, setAuthUrl] = useState('');

  const submitAuthCode = useCallback(async (authCode: string) => {
    if (!code || !authCode.trim()) return;
    setCodeDialogOpen(false);
    setSavingToYandexDisk(true);
    setProgress(0);
    setProgressTotal(0);
    setProgressDone(0);

    const baseBody: Record<string, unknown> = {
      code,
      subfolder_id: pendingSubfolderId ?? undefined,
      limit: BATCH_SIZE,
    };

    try {
      // Первый батч: обмениваем код на токен и грузим первую порцию
      let resp = await fetch(YANDEX_DISK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseBody, auth_code: authCode.trim(), offset: 0 }),
      });
      let data = await resp.json();

      if (!resp.ok || (!data.token && !data.done)) {
        toast.error(data.error || 'Не удалось загрузить фото на Яндекс.Диск');
        setSavingToYandexDisk(false);
        return;
      }

      const token: string = data.token;
      const total: number = data.total || 0;
      let folderName: string = data.disk_folder || '';
      let totalFailed = 0;

      setProgressTotal(total);
      setProgressDone(data.processed || 0);
      setProgress(total > 0 ? Math.round(((data.processed || 0) / total) * 100) : 100);
      totalFailed += data.failed || 0;

      let offset = data.processed || 0;
      // Догружаем остальные батчи с тем же токеном
      while (!data.done && offset < total) {
        resp = await fetch(YANDEX_DISK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...baseBody, token, offset }),
        });
        data = await resp.json();
        if (!resp.ok) break;
        folderName = data.disk_folder || folderName;
        offset = data.processed || offset;
        totalFailed += data.failed || 0;
        setProgressDone(offset);
        setProgress(total > 0 ? Math.round((offset / total) * 100) : 100);
      }

      setProgress(100);
      if (totalFailed > 0) {
        toast.warning(
          `Загружено ${total - totalFailed} из ${total} фото в папку «${folderName}» на вашем Яндекс.Диске. ${totalFailed} не удалось.`,
          { duration: 8000 }
        );
      } else {
        toast.success(
          `Готово! Все ${total} фото загружаются в папку «${folderName}» на вашем Яндекс.Диске. Это может занять несколько минут.`,
          { duration: 8000 }
        );
      }
    } catch {
      toast.error('Ошибка соединения с Яндекс.Диском');
    } finally {
      setSavingToYandexDisk(false);
    }
  }, [code, pendingSubfolderId]);

  const saveToYandexDisk = useCallback(async (subfolderId?: number) => {
    if (!code) return;
    setPendingSubfolderId(subfolderId ?? null);
    try {
      const resp = await fetch(`${YANDEX_DISK_URL}?action=auth_url&code=${encodeURIComponent(code)}`);
      const data = await resp.json();
      if (!resp.ok || !data.auth_url) {
        toast.error(data.error || 'Не удалось открыть авторизацию Яндекс.Диска');
        return;
      }

      // Сначала показываем наше окно с инструкцией и кнопкой "Открыть Яндекс",
      // чтобы клиент не потерял поле для ввода кода.
      setAuthUrl(data.auth_url);
      setCodeDialogOpen(true);
    } catch {
      toast.error('Не удалось начать загрузку на Яндекс.Диск');
    }
  }, [code]);

  return {
    saveToYandexDisk,
    savingToYandexDisk,
    codeDialogOpen,
    setCodeDialogOpen,
    submitAuthCode,
    progress,
    progressTotal,
    progressDone,
    authUrl,
  };
}