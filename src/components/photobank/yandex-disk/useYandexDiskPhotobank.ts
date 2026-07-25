import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const YD_URL = 'https://functions.poehali.dev/76f7709b-71a3-414b-ae0f-429082000126';

export interface DiskFolder {
  name: string;
  path: string;
}

export interface DiskPhoto {
  name: string;
  path: string;
  preview: string;
  file: string;
  size: number;
  mime_type: string;
}

export const YANDEX_DISK_FN_URL = YD_URL;

// Строит URL картинки через прокси бэкенда (превью или оригинал)
export function diskImageUrl(path: string, token: string, size: 'preview' | 'orig' = 'preview'): string {
  const p = new URLSearchParams({ action: 'image', path, token, size });
  return `${YD_URL}?${p.toString()}`;
}

type Mode = 'import' | 'export';

interface Options {
  userId: number | string;
  onImportDone?: (folderId: number) => void;
}

export function useYandexDiskPhotobank({ userId, onImportDone }: Options) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('import');
  const [authUrl, setAuthUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  // Шаг диалога: 'auth' — ввод кода, 'browse' — выбор папки Диска, 'progress' — идёт обработка
  const [step, setStep] = useState<'auth' | 'browse' | 'progress'>('auth');

  const [diskPath, setDiskPath] = useState('/');
  const [folders, setFolders] = useState<DiskFolder[]>([]);
  const [photosHere, setPhotosHere] = useState(0);
  const [diskPhotos, setDiskPhotos] = useState<DiskPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);

  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressDone, setProgressDone] = useState(0);

  const [exportFolderId, setExportFolderId] = useState<number | null>(null);
  const [exportFolderName, setExportFolderName] = useState('');

  const authHeaders = { 'Content-Type': 'application/json', 'X-User-Id': String(userId) };

  const reset = () => {
    setToken('');
    setStep('auth');
    setDiskPath('/');
    setFolders([]);
    setPhotosHere(0);
    setDiskPhotos([]);
    setPhotosLoading(false);
    setProgress(0);
    setProgressTotal(0);
    setProgressDone(0);
  };

  const fetchAuthUrl = async (): Promise<boolean> => {
    try {
      const r = await fetch(`${YD_URL}?action=auth_url`);
      const d = await r.json();
      if (!r.ok || !d.auth_url) {
        toast.error(d.error || 'Не удалось открыть авторизацию Яндекс.Диска');
        return false;
      }
      setAuthUrl(d.auth_url);
      return true;
    } catch {
      toast.error('Ошибка соединения с Яндекс.Диском');
      return false;
    }
  };

  const openImport = useCallback(async () => {
    reset();
    setMode('import');
    if (await fetchAuthUrl()) setOpen(true);
  }, []);

  const openExport = useCallback(async (folderId: number, folderName: string) => {
    reset();
    setMode('export');
    setExportFolderId(folderId);
    setExportFolderName(folderName);
    if (await fetchAuthUrl()) setOpen(true);
  }, []);

  const loadPhotos = useCallback(async (path: string, tok: string) => {
    if (!tok) return;
    setPhotosLoading(true);
    setDiskPhotos([]);
    try {
      const r = await fetch(YD_URL, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ op: 'list_photos', path, token: tok }),
      });
      const d = await r.json();
      if (r.ok) setDiskPhotos(d.photos || []);
    } catch {
      /* тихо — просмотр фото не критичен для выбора папки */
    } finally {
      setPhotosLoading(false);
    }
  }, [authHeaders]);

  const browse = useCallback(async (path: string) => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await fetch(YD_URL, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ op: 'list_folders', path, token }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || 'Не удалось открыть папку'); return; }
      const newPath = d.path || path;
      setDiskPath(newPath);
      setFolders(d.folders || []);
      setPhotosHere(d.photos_here || 0);
      loadPhotos(newPath, token);
    } catch {
      toast.error('Ошибка соединения с Яндекс.Диском');
    } finally {
      setBusy(false);
    }
  }, [token, authHeaders]);

  const runExport = useCallback(async (tok: string) => {
    if (!exportFolderId) return;
    setStep('progress');
    setBusy(true);
    setProgress(0); setProgressDone(0); setProgressTotal(0);
    try {
      let offset = 0;
      let resp = await fetch(YD_URL, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ op: 'export', folder_id: exportFolderId, token: tok, offset: 0 }),
      });
      let data = await resp.json();
      if (!resp.ok) { toast.error(data.error || 'Не удалось выгрузить на Яндекс.Диск'); return; }
      const total: number = data.total || 0;
      let failed = data.failed || 0;
      const diskFolder = data.disk_folder || exportFolderName;
      offset = data.processed || 0;
      setProgressTotal(total);
      setProgressDone(offset);
      setProgress(total > 0 ? Math.round((offset / total) * 100) : 100);

      while (!data.done && offset < total) {
        resp = await fetch(YD_URL, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ op: 'export', folder_id: exportFolderId, token: tok, offset }),
        });
        data = await resp.json();
        if (!resp.ok) break;
        offset = data.processed || offset;
        failed += data.failed || 0;
        setProgressDone(offset);
        setProgress(total > 0 ? Math.round((offset / total) * 100) : 100);
      }
      setProgress(100);
      setOpen(false);
      if (failed > 0) {
        toast.warning(`Выгружено ${total - failed} из ${total} фото в папку «${diskFolder}» на Яндекс.Диске. ${failed} не удалось.`, { duration: 8000 });
      } else {
        toast.success(`Готово! Все ${total} фото выгружаются в папку «${diskFolder}» на вашем Яндекс.Диске. Это может занять несколько минут.`, { duration: 8000 });
      }
    } catch {
      toast.error('Ошибка соединения с Яндекс.Диском');
    } finally {
      setBusy(false);
    }
  }, [exportFolderId, exportFolderName, authHeaders]);

  // Ввод кода авторизации
  const submitAuthCode = useCallback(async (authCode: string) => {
    const code = authCode.trim();
    if (!code) return;
    setBusy(true);
    try {
      if (mode === 'import') {
        // Меняем код на токен + сразу показываем корень Диска
        const r = await fetch(YD_URL, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ op: 'list_folders', path: '/', auth_code: code }),
        });
        const d = await r.json();
        if (!r.ok || !d.token) { toast.error(d.error || 'Ошибка авторизации Яндекс.Диска'); return; }
        setToken(d.token);
        const newPath = d.path || '/';
        setDiskPath(newPath);
        setFolders(d.folders || []);
        setPhotosHere(d.photos_here || 0);
        setStep('browse');
        loadPhotos(newPath, d.token);
      } else {
        // Экспорт: получаем токен и запускаем выгрузку выбранной папки
        const r = await fetch(YD_URL, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ op: 'exchange', auth_code: code }),
        });
        const d = await r.json();
        if (!r.ok || !d.token) { toast.error(d.error || 'Ошибка авторизации Яндекс.Диска'); return; }
        setToken(d.token);
        await runExport(d.token);
      }
    } catch {
      toast.error('Ошибка соединения с Яндекс.Диском');
    } finally {
      setBusy(false);
    }
  }, [mode, authHeaders, runExport, loadPhotos]);

  const runImport = useCallback(async (path: string) => {
    if (!token) return;
    setStep('progress');
    setBusy(true);
    setProgress(0); setProgressDone(0); setProgressTotal(0);
    try {
      let resp = await fetch(YD_URL, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ op: 'import', disk_path: path, token, offset: 0 }),
      });
      let data = await resp.json();
      if (!resp.ok) { toast.error(data.error || 'Не удалось импортировать фото'); return; }
      const total: number = data.total || 0;
      const folderId: number | undefined = data.folder_id;
      let offset: number = data.processed || 0;
      let failed = data.failed || 0;
      setProgressTotal(total);
      setProgressDone(offset);
      setProgress(total > 0 ? Math.round((offset / total) * 100) : 100);

      while (!data.done && offset < total) {
        resp = await fetch(YD_URL, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ op: 'import', disk_path: path, folder_id: folderId, token, offset }),
        });
        data = await resp.json();
        if (!resp.ok) break;
        offset = data.processed || offset;
        failed += data.failed || 0;
        setProgressDone(offset);
        setProgress(total > 0 ? Math.round((offset / total) * 100) : 100);
      }
      setProgress(100);
      setOpen(false);
      if (failed > 0) {
        toast.warning(`Импортировано ${total - failed} из ${total} фото. ${failed} не удалось.`, { duration: 8000 });
      } else {
        toast.success(`Готово! Импортировано ${total} фото в фотобанк.`, { duration: 8000 });
      }
      if (folderId && onImportDone) onImportDone(folderId);
    } catch {
      toast.error('Ошибка соединения с Яндекс.Диском');
    } finally {
      setBusy(false);
    }
  }, [token, authHeaders, onImportDone]);

  return {
    open, setOpen, mode, step, authUrl, busy, token,
    diskPath, folders, photosHere, diskPhotos, photosLoading,
    progress, progressTotal, progressDone,
    exportFolderName,
    openImport, openExport,
    submitAuthCode, browse, runImport,
  };
}