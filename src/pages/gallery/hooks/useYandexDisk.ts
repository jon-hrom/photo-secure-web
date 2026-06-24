import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const YANDEX_DISK_URL = 'https://functions.poehali.dev/e4f749e4-5c96-48dd-9787-17c4179176bb';

export function useYandexDisk(code?: string) {
  const [savingToYandexDisk, setSavingToYandexDisk] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);

  const submitAuthCode = useCallback(async (authCode: string) => {
    if (!code || !authCode.trim()) return;
    setCodeDialogOpen(false);
    setSavingToYandexDisk(true);
    const t = toast.loading('Отправляем фото на ваш Яндекс.Диск...');
    try {
      const resp = await fetch(YANDEX_DISK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_code: authCode.trim(), code }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        toast.success(
          `Готово! ${data.queued} из ${data.total} фото загружаются в папку «${data.disk_folder}» на вашем Яндекс.Диске. Это может занять несколько минут.`,
          { id: t, duration: 8000 }
        );
      } else {
        toast.error(data.error || 'Не удалось загрузить фото на Яндекс.Диск', { id: t });
      }
    } catch {
      toast.error('Ошибка соединения с Яндекс.Диском', { id: t });
    } finally {
      setSavingToYandexDisk(false);
    }
  }, [code]);

  const saveToYandexDisk = useCallback(async () => {
    if (!code) return;
    try {
      const resp = await fetch(`${YANDEX_DISK_URL}?action=auth_url&code=${encodeURIComponent(code)}`);
      const data = await resp.json();
      if (!resp.ok || !data.auth_url) {
        toast.error(data.error || 'Не удалось открыть авторизацию Яндекс.Диска');
        return;
      }

      const w = 640, h = 720;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(
        data.auth_url,
        'yandex-disk-auth',
        `width=${w},height=${h},left=${left},top=${top}`
      );

      // Яндекс покажет клиенту код подтверждения — открываем окно ввода кода
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
  };
}
