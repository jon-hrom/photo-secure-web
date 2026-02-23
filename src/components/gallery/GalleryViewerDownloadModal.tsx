import Icon from '@/components/ui/icon';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  file_size: number;
}

interface GalleryViewerDownloadModalProps {
  photo: Photo;
  onClose: () => void;
  onDownload?: (photo: Photo) => void;
}

export default function GalleryViewerDownloadModal({ photo, onClose, onDownload }: GalleryViewerDownloadModalProps) {
  const downloadFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleWebVersion = async () => {
    onClose();
    await downloadFile(
      photo.thumbnail_url!,
      `web_${photo.file_name.replace(/\.[^.]+$/, '.jpg')}`
    );
  };

  const handleOriginal = async () => {
    onClose();
    if (onDownload) {
      onDownload(photo);
    } else {
      await downloadFile(photo.photo_url, photo.file_name);
    }
  };

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Скачать фото</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{photo.file_name}</p>

        <div className="space-y-3">
          {photo.thumbnail_url && (
            <button
              onClick={handleWebVersion}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                <Icon name="Image" size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">Веб-версия</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Оптимизированное для интернета</p>
              </div>
            </button>
          )}
          <button
            onClick={handleOriginal}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
              <Icon name="Download" size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white text-sm">Оригинал</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Полное качество, оригинальный файл</p>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-gray-500 dark:text-gray-400 py-2"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
