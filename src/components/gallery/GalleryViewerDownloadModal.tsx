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

/**
 * Приводит имя файла к безопасному виду.
 * У фото из фотобанка имена вида "  (1).jpg" — с пробелами и скобками.
 * Такое имя ломает сохранение на iPhone, поэтому чистим его.
 */
const safeFileName = (raw: string, photoId: number, prefix = ''): string => {
  const cleaned = (raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^[_.]+/, '');

  const hasExt = /\.(jpe?g|png|heic|webp|gif)$/i.test(cleaned);
  const base = hasExt ? cleaned.replace(/\.[^.]+$/, '') : cleaned;
  const safeBase = base.length >= 1 ? base : `photo_${photoId}`;
  return `${prefix}${safeBase}.jpg`;
};

export default function GalleryViewerDownloadModal({ photo, onClose, onDownload }: GalleryViewerDownloadModalProps) {
  const ios = isIOS();
  const [busy, setBusy] = useState<'web' | 'original' | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [readyBlob, setReadyBlob] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [directUrl, setDirectUrl] = useState<{ url: string; fileName: string } | null>(null);
  const [shareFailed, setShareFailed] = useState(false);

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
        if (data.download_url) {
          console.log('[DL] got presigned url');
          return data.download_url;
        }
      }
      console.warn('[DL] presigned failed, status', resp.status);
    } catch (e) {
      console.warn('[DL] presigned error', e);
    }
    return photo.photo_url;
  };

  const fetchWithProgress = async (url: string): Promise<Blob> => {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const total = Number(resp.headers.get('content-length')) || photo.file_size || 0;
    if (!resp.body || !total) return await resp.blob();

    const reader = resp.body.getReader();
    const chunks: BlobPart[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value.slice().buffer as ArrayBuffer);
        loaded += value.length;
        setProgress(Math.min(99, Math.round((loaded / total) * 100)));
      }
    }
    setProgress(100);
    return new Blob(chunks, { type: resp.headers.get('content-type') || 'image/jpeg' });
  };

  const run = async (kind: 'web' | 'original') => {
    setError(null);
    setShareFailed(false);
    setBusy(kind);
    setProgress(0);
    try {
      const fileName =
        kind === 'web'
          ? safeFileName(photo.file_name, photo.id, 'web_')
          : safeFileName(photo.file_name, photo.id);

      const originalUrl = await getOriginalUrl();
      const url = kind === 'web' ? getThumbUrl(originalUrl, 2560) || originalUrl : originalUrl;

      // Прямая ссылка — запасной путь, если системное сохранение не сработает
      setDirectUrl({ url, fileName });

      const blob = await fetchWithProgress(url);
      console.log('[DL] blob ready', blob.size, blob.type, fileName);

      if (ios) {
        const canShare = canShareBlob(blob, fileName);
        console.log('[DL] iOS canShare =', canShare);
        setReadyBlob({ blob, fileName });
        if (!canShare) setShareFailed(true);
        setBusy(null);
        return;
      }

      await saveBlobToDevice(blob, fileName);
      if (kind === 'original' && onDownload) onDownload(photo);
      setBusy(null);
      onClose();
    } catch (e) {
      console.error('[DL] failed', e);
      setBusy(null);
      setError('Не удалось загрузить файл. Проверьте связь или откройте фото по ссылке ниже.');
    }
  };

  const handleSaveReady = async () => {
    if (!readyBlob) return;
    const ok = await shareBlobNow(readyBlob.blob, readyBlob.fileName);
    console.log('[DL] share result =', ok);

    if (!ok) {
      // Меню не открылось — показываем запасной путь, окно НЕ закрываем,
      // чтобы клиент не остался ни с чем.
      setShareFailed(true);
      return;
    }

    if (onDownload) onDownload(photo);
    onClose();
  };

  const openDirect = () => {
    if (!directUrl) return;
    const objectUrl = URL.createObjectURL(readyBlob?.blob ?? new Blob());
    const target = readyBlob ? objectUrl : directUrl.url;
    window.open(target, '_blank', 'noopener');
    if (readyBlob) setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    if (onDownload) onDownload(photo);
  };

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Скачать фото</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 break-all">{photo.file_name}</p>

        {readyBlob ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Icon name="CheckCircle" size={18} />
              <span>Фото загружено</span>
            </div>

            {!shareFailed && (
              <>
                <button
                  onClick={handleSaveReady}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors"
                >
                  <Icon name="Download" size={18} />
                  Сохранить в Фото
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Откроется меню iPhone — пролистайте до пункта «Сохранить изображение».
                </p>
              </>
            )}

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
              <p className="text-xs font-medium text-gray-900 dark:text-white">
                {shareFailed ? 'Сохраните фото так:' : 'Не получилось? Способ, который работает всегда:'}
              </p>
              <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                <li>Нажмите кнопку ниже — фото откроется на весь экран</li>
                <li>Задержите на нём палец на пару секунд</li>
                <li>Выберите «Добавить в Фото» или «Сохранить в Фото»</li>
              </ol>
              <button
                onClick={openDirect}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
              >
                <Icon name="ExternalLink" size={18} />
                Открыть фото
              </button>
            </div>
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
              {busy === 'original'
                ? `Оригинал весит около ${Math.max(1, Math.round((photo.file_size || 0) / (1024 * 1024)))} МБ — не закрывайте окно.`
                : 'Готовим уменьшенную копию — это быстро.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {photo.thumbnail_url && (
              <button
                onClick={() => run('web')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                  <Icon name="Image" size={20} className="text-blue-600 dark:text-blue-400" />
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
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                <Icon name="Download" size={20} className="text-green-600 dark:text-green-400" />
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

        {!busy && (
          <button
            onClick={onClose}
            className="mt-4 w-full text-center text-sm text-gray-500 dark:text-gray-400 py-2"
          >
            {readyBlob ? 'Готово' : 'Отмена'}
          </button>
        )}
      </div>
    </div>
  );
}
