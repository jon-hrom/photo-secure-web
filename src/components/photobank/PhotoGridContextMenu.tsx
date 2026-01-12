import Icon from '@/components/ui/icon';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface PhotoGridContextMenuProps {
  viewPhoto: Photo;
  showContextMenu: boolean;
  onClose: () => void;
  onDownload: (s3Key: string, fileName: string, userId: number) => Promise<void>;
  onShowExif: () => void;
  formatBytes: (bytes: number) => string;
}

const PhotoGridContextMenu = ({
  viewPhoto,
  showContextMenu,
  onClose,
  onDownload,
  onShowExif,
  formatBytes
}: PhotoGridContextMenuProps) => {
  if (!showContextMenu) return null;

  const handleShare = async () => {
    try {
      const photoPath = viewPhoto.s3_key || '';
      const response = await fetch('https://functions.poehali.dev/c7c9c0c2-b26f-442d-ad1c-dd7c3185ac44', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_path: photoPath,
          photo_name: viewPhoto.file_name
        })
      });
      
      const data = await response.json();
      const shortUrl = data.short_url || viewPhoto.s3_url || '';
      
      if (navigator.share) {
        await navigator.share({
          title: viewPhoto.file_name,
          text: `Фото: ${viewPhoto.file_name}`,
          url: shortUrl
        });
      } else {
        await navigator.clipboard.writeText(shortUrl);
        alert('Ссылка скопирована в буфер обмена');
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
    onClose();
  };

  const handleCopyLink = async () => {
    try {
      const photoPath = viewPhoto.s3_key || '';
      const response = await fetch('https://functions.poehali.dev/c7c9c0c2-b26f-442d-ad1c-dd7c3185ac44', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_path: photoPath,
          photo_name: viewPhoto.file_name
        })
      });
      
      const data = await response.json();
      const shortUrl = data.short_url || viewPhoto.s3_url || '';
      
      await navigator.clipboard.writeText(shortUrl);
      alert('Ссылка скопирована');
    } catch (error) {
      console.error('Copy failed:', error);
    }
    onClose();
  };

  const handleSetWallpaper = async () => {
    const url = viewPhoto.s3_url || viewPhoto.thumbnail_s3_url || '';
    window.open(url, '_blank');
    alert('Откройте изображение и установите как обои через меню браузера');
    onClose();
  };

  const handleRotate = () => {
    alert('Функция поворота в разработке');
    onClose();
  };

  return (
    <div 
      className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-white/95 dark:bg-gray-900/95 rounded-2xl p-2 w-[90%] max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-2 gap-2 p-2">
          <button
            onClick={async () => {
              const userIdStr = getAuthUserId();
              const userId = userIdStr ? parseInt(userIdStr, 10) : 0;
              if (userId && viewPhoto.s3_key) {
                await onDownload(viewPhoto.s3_key, viewPhoto.file_name, userId);
              }
              onClose();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 active:bg-blue-200 transition-colors"
          >
            <Icon name="Download" size={28} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Скачать</span>
          </button>

          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 hover:bg-green-100 active:bg-green-200 transition-colors"
          >
            <Icon name="Share2" size={28} className="text-green-600" />
            <span className="text-sm font-medium text-green-900">Поделиться</span>
          </button>

          <button
            onClick={() => {
              onShowExif();
              onClose();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 active:bg-purple-200 transition-colors"
          >
            <Icon name="Info" size={28} className="text-purple-600" />
            <span className="text-sm font-medium text-purple-900">Информация</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-50 hover:bg-orange-100 active:bg-orange-200 transition-colors"
          >
            <Icon name="Link" size={28} className="text-orange-600" />
            <span className="text-sm font-medium text-orange-900">Копировать</span>
          </button>

          <button
            onClick={handleSetWallpaper}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-pink-50 hover:bg-pink-100 active:bg-pink-200 transition-colors"
          >
            <Icon name="Image" size={28} className="text-pink-600" />
            <span className="text-sm font-medium text-pink-900">Обои</span>
          </button>

          <button
            onClick={handleRotate}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 transition-colors"
          >
            <Icon name="RotateCw" size={28} className="text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">Повернуть</span>
          </button>

          {viewPhoto.width && viewPhoto.height && (
            <button
              onClick={() => {
                alert(`Разрешение: ${viewPhoto.width}×${viewPhoto.height}\nРазмер: ${formatBytes(viewPhoto.file_size)}\nФормат: ${viewPhoto.is_raw ? 'RAW' : 'JPG/PNG'}`);
                onClose();
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-teal-50 hover:bg-teal-100 active:bg-teal-200 transition-colors"
            >
              <Icon name="Maximize2" size={28} className="text-teal-600" />
              <span className="text-sm font-medium text-teal-900">Детали</span>
            </button>
          )}

          <button
            onClick={() => {
              navigator.clipboard.writeText(viewPhoto.file_name);
              alert('Имя файла скопировано');
              onClose();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 transition-colors"
          >
            <Icon name="FileText" size={28} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-900">Имя файла</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-2 p-3 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors text-center font-medium text-gray-700"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};

export default PhotoGridContextMenu;