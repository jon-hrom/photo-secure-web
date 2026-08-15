import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { isIOS, saveBlobToDevice, shareBlobNow, canShareBlob } from '@/utils/savePhoto';
import { getThumbUrl } from '@/utils/imageThumb';

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
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [readyBlob, setReadyBlob] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [directUrl, setDirectUrl] = useState<{ url: string; fileName: string } | null>(null);

  const getOriginalUrl = async (): Promise<string> => {
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
        if (data.download_url) return data.download_url;
      }
    } catch { /* ниже вернём прямую ссылку */ }
    return photo.photo_url;
  };

  const fetchWithProgress = async (url: string): Promise<Blob> => {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const total = Number(resp.headers.get('content-length')) || photo.file_size || 0;
    if (!resp.body || !total) return await resp.blob();

    const reader = resp.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.length;
        setProgress(Math.min(99, Math.round((loaded / total) * 100)));
      }
    }
    setProgress(100);
    return new Blob(chunks as BlobPart[], { type: resp.headers.get('content-type') || 'image/jpeg' });
  };

  const run = async (kind: 'web' | 'original') => {
    setError(null);
    setBusy(kind);
    setProgress(0);
    try {
      const fileName =
        kind === 'web'
          ? `web_${photo.file_name.trim().replace(/\.[^.]+$/, '')}.jpg`
          : photo.file_name.trim() || `photo_${photo.id}.jpg`;

      const originalUrl = await getOriginalUrl();
      // Веб-версия: уменьшаем оригинал на лету до 2560px — это ~1,5 МБ
      // и отличное качество, вместо крошечного превью 500px.
      const url = kind === 'web' ? getThumbUrl(originalUrl, 2560) || photo.thumbnail_url! : originalUrl;

      // Ссылка на файл — гарантированный запасной путь для iPhone,
      // если системное «Сохранить в Фото» окажется недоступным.
      setDirectUrl({ url, fileName });

      const blob = await fetchWithProgress(url);

      if (ios) {
        if (canShareBlob(blob, fileName)) {
          setReadyBlob({ blob, fileName });
          setBusy(null);
          return;
        }
        // Safari не даёт сохранить файл напрямую — открываем фото,
        // клиент сохранит его долгим нажатием.
        setBusy(null);
        setError(null);
        return;
      }

      await saveBlobToDevice(blob, fileName);
      if (kind === 'original' && onDownload) onDownload(photo);
      setBusy(null);
      onClose();
    } catch {
      setBusy(null);
      setError('Не удалось загрузить файл. Проверьте связь или откройте фото по ссылке ниже.');
    }
  };

  const handleSaveReady = async () => {
    if (!readyBlob) return;
    const ok = await shareBlobNow(readyBlob.blob, readyBlob.fileName);
    if (!ok && directUrl) {
      window.location.href = directUrl.url;
      return;
    }
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
            {directUrl && (
              <a
                href={directUrl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-blue-600 dark:text-blue-400 underline py-1"
              >
                Не получилось? Открыть фото и сохранить долгим нажатием
              </a>
            )}
          </div>
        ) : busy ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <Icon name="Loader" size={18} className="animate-spin" />
              <span>Загружаем фото… {progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Оригинал весит около {Math.max(1, Math.round((photo.file_size || 0) / (1024 * 1024)))} МБ — не закрывайте окно.
            </p>
          </div>
        ) : ios && directUrl && !readyBlob ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Фото готово. Откройте его и удерживайте палец на снимке, затем выберите «Добавить в Фото».
            </p>
            <a
              href={directUrl.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors"
            >
              <Icon name="ExternalLink" size={18} />
              Открыть фото
            </a>
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
                    Хорошее качество, быстро — для телефона и соцсетей
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
                  Максимальное качество{photo.file_size ? `, ~${Math.max(1, Math.round(photo.file_size / (1024 * 1024)))} МБ` : ''}
                </p>
              </div>
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{error}</p>
            {directUrl && (
              <a
                href={directUrl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-blue-600 dark:text-blue-400 underline py-1"
              >
                Открыть фото по прямой ссылке
              </a>
            )}
          </div>
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