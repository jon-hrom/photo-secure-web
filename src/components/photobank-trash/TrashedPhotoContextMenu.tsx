import Icon from '@/components/ui/icon';
import { TrashedPhoto } from './types';

interface TrashedPhotoContextMenuProps {
  viewPhoto: TrashedPhoto;
  showContextMenu: boolean;
  onClose: () => void;
  onRestorePhoto: (photoId: number, fileName: string) => void;
  onDeletePhotoForever: (photoId: number, fileName: string) => void;
  getDaysLeftBadge: (dateStr: string) => { days: number; variant: string; text: string };
  formatDate: (dateStr: string) => string;
  formatBytes: (bytes: number) => string;
}

const TrashedPhotoContextMenu = ({
  viewPhoto,
  showContextMenu,
  onClose,
  onRestorePhoto,
  onDeletePhotoForever,
  getDaysLeftBadge,
  formatDate,
  formatBytes
}: TrashedPhotoContextMenuProps) => {
  if (!showContextMenu) return null;

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
            onClick={() => {
              onRestorePhoto(viewPhoto.id, viewPhoto.file_name);
              onClose();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 hover:bg-green-100 active:bg-green-200 transition-colors"
          >
            <Icon name="Undo2" size={28} className="text-green-600" />
            <span className="text-sm font-medium text-green-900">Восстановить</span>
          </button>

          <button
            onClick={() => {
              onDeletePhotoForever(viewPhoto.id, viewPhoto.file_name);
              onClose();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-red-50 hover:bg-red-100 active:bg-red-200 transition-colors"
          >
            <Icon name="Trash2" size={28} className="text-red-600" />
            <span className="text-sm font-medium text-red-900">Удалить</span>
          </button>

          <button
            onClick={async () => {
              try {
                const url = viewPhoto.s3_url || '';
                if (navigator.share) {
                  await navigator.share({
                    title: viewPhoto.file_name,
                    url: url
                  });
                } else {
                  await navigator.clipboard.writeText(url);
                  alert('Ссылка скопирована');
                }
              } catch (error) {
                console.error('Share failed:', error);
              }
              onClose();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 active:bg-blue-200 transition-colors"
          >
            <Icon name="Share2" size={28} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Поделиться</span>
          </button>

          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(viewPhoto.s3_url || '');
                alert('Ссылка скопирована');
              } catch (error) {
                console.error('Copy failed:', error);
              }
              onClose();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-50 hover:bg-orange-100 active:bg-orange-200 transition-colors"
          >
            <Icon name="Link" size={28} className="text-orange-600" />
            <span className="text-sm font-medium text-orange-900">Копировать</span>
          </button>

          <button
            onClick={() => {
              const badge = getDaysLeftBadge(viewPhoto.trashed_at);
              alert(`Удалено: ${formatDate(viewPhoto.trashed_at)}\nОсталось: ${badge.text}\nРазмер: ${formatBytes(viewPhoto.file_size || 0)}`);
              onClose();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 active:bg-purple-200 transition-colors"
          >
            <Icon name="Clock" size={28} className="text-purple-600" />
            <span className="text-sm font-medium text-purple-900">Инфо</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(viewPhoto.file_name);
              alert('Имя файла скопировано');
              onClose();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-teal-50 hover:bg-teal-100 active:bg-teal-200 transition-colors"
          >
            <Icon name="FileText" size={28} className="text-teal-600" />
            <span className="text-sm font-medium text-teal-900">Имя</span>
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

export default TrashedPhotoContextMenu;
