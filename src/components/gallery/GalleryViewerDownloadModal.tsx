import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { isIOS, saveBlobToDevice, shareBlobNow, canShareBlob } from '@/utils/savePhoto';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  file_size: number;
  s3_key?: string;
  folder_id?: number;
}

interface GalleryViewerDownloadModalProps {
  photo: Photo;
  onClose: () => void;
  onDownload?: (photo: Photo) => void;
}

const DOWNLOAD_API = 'https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215';

export default function GalleryViewerDownloadModal({ photo, onClose, onDownload }: GalleryViewerDownloadModalProps) {
  const ios = isIOS();
  const [busy, setBusy] = useState<'web' | 'original' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyBlob, setReadyBlob] = useState<{ blob: Blob; fileName: string } | null>(null);

  const fetchOriginal = async (): Promise<Blob> => {
    if (photo.s3_key || photo.id) {
      const params = new URLSearchParams({
        photo_id: photo.id.toString(),
        presigned: 'true',
        ...(photo.s3_key ? { s3_key: photo.s3_key } : {}),
        ...(photo.folder_id ? { folder_id: photo.folder_id.toString() } : {}),
      });
      try {
        const resp = await fetch(`${DOWNLOAD_API}?${params.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.download_url) {
            const file = await fetch(data.download_url, { mode: 'cors' });
            if (file.ok) return await file.blob();
          }
        }
      } catch { /* пробуем прямую ссылку ниже */ }
    }

    const direct = await fetch(photo.photo_url, { mode: 'cors' });
    if (!direct.ok) throw new Error(`HTTP ${direct.status}`);
    return await direct.blob();
  };

  const run = async (kind: 'web' | 'original') => {
    setError(null);
    setBusy(kind);
    try {
      let blob: Blob;
      let fileName: string;

      if (kind === 'web') {
        fileName = `web_${photo.file_name.trim().replace(/\.[^.]+$/, '')}.jpg`;
        const resp = await fetch(photo.thumbnail_url!, { mode: 'cors' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        blob = await resp.blob();
      } else {
        fileName = photo.file_name.trim() || `photo_${photo.id}.jpg`;
        blob = await fetchOriginal();
      }

      if (ios && canShareBlob(blob, fileName)) {
        setReadyBlob({ blob, fileName });
        setBusy(null);
        return;
      }

      await saveBlobToDevice(blob, fileName);
      if (kind === 'original' && onDownload) onDownload(photo);
      setBusy(null);
      onClose();
    } catch (e) {
      setBusy(null);
      setError('Не удалось подготовить файл. Проверьте соединение и попробуйте ещё раз.');
    }
  };

  const handleSaveReady = async () => {
    if (!readyBlob) return;
    const ok = await shareBlobNow(readyBlob.blob, readyBlob.fileName);
    if (!ok) {
      await saveBlobToDevice(readyBlob.blob, readyBlob.fileName);
    }
    if (onDownload) onDownload(photo);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Скачать фото</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 break-all">{photo.file_name}</p>

        {readyBlob ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Icon name="CheckCircle" size={18} />
              <span>Фото готово</span>
            </div>
            <button
              onClick={handleSaveReady}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors"
            >
              <Icon name="Download" size={18} />
              Сохранить в Фото
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Откроется меню iPhone — пролистайте до пункта «Сохранить изображение», и снимок появится в галерее.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {photo.thumbnail_url && (
              <button
                onClick={() => run('web')}
                disabled={!!busy}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                  <Icon name={busy === 'web' ? 'Loader' : 'Image'} size={20} className={`text-blue-600 dark:text-blue-400 ${busy === 'web' ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">Веб-версия</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {busy === 'web' ? 'Готовим файл…' : 'Меньше размер, быстрее загрузка'}
                  </p>
                </div>
              </button>
            )}
            <button
              onClick={() => run('original')}
              disabled={!!busy}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                <Icon name={busy === 'original' ? 'Loader' : 'Download'} size={20} className={`text-green-600 dark:text-green-400 ${busy === 'original' ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">Оригинал</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {busy === 'original' ? 'Готовим файл, это может занять время…' : 'Полное качество, оригинальный файл'}
                </p>
              </div>
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-xs text-red-600 dark:text-red-400 leading-relaxed">{error}</p>
        )}

        {!readyBlob && !busy && ios && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            На iPhone фото можно сохранить прямо в галерею — мы подскажем, как, после подготовки файла.
          </p>
        )}

        {!busy && (
          <button
            onClick={onClose}
            className="mt-4 w-full text-center text-sm text-gray-500 dark:text-gray-400 py-2"
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}