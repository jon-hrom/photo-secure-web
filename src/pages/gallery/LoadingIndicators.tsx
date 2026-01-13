import Icon from '@/components/ui/icon';

interface LoadingIndicatorsProps {
  loadingProgress: number;
  photosLoaded: number;
  totalPhotos: number;
  downloadProgress: {
    show: boolean;
    current: number;
    total: number;
    status: 'preparing' | 'downloading' | 'completed';
  };
  onCancelDownload: () => void;
}

export default function LoadingIndicators({
  loadingProgress,
  photosLoaded,
  totalPhotos,
  downloadProgress,
  onCancelDownload
}: LoadingIndicatorsProps) {
  return (
    <>
      {loadingProgress > 0 && loadingProgress < 100 && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-[#111111] rounded-lg shadow-lg p-8 max-w-md w-full mx-4 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="ImageIcon" size={24} className="text-[#4cc9f0]" />
              <div className="flex-1">
                <h3 className="font-semibold text-white text-lg">
                  Подождите
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Идёт размещение фото для удобного просмотра
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-[#4cc9f0] transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center">
                Загружено {photosLoaded} из {totalPhotos} фото
              </p>
            </div>
          </div>
        </div>
      )}

      {downloadProgress.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#111111] rounded-lg shadow-lg p-8 max-w-md w-full mx-4 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              {downloadProgress.status === 'preparing' && (
                <Icon name="Loader2" size={24} className="text-[#4cc9f0] animate-spin" />
              )}
              {downloadProgress.status === 'downloading' && (
                <Icon name="Download" size={24} className="text-[#4cc9f0]" />
              )}
              {downloadProgress.status === 'completed' && (
                <Icon name="CheckCircle2" size={24} className="text-green-500" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-white text-lg">
                  {downloadProgress.status === 'preparing' && 'Подготовка...'}
                  {downloadProgress.status === 'downloading' && 'Создание архива...'}
                  {downloadProgress.status === 'completed' && 'Готово!'}
                </h3>
                {downloadProgress.status === 'downloading' && (
                  <p className="text-sm text-gray-400 mt-1">
                    {downloadProgress.current} из {downloadProgress.total} фото
                  </p>
                )}
              </div>
            </div>

            {downloadProgress.status !== 'completed' && (
              <div className="space-y-2">
                <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-[#4cc9f0] transition-all duration-300"
                    style={{ width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-400 text-center">
                  {downloadProgress.status === 'preparing' && 'Получение списка файлов...'}
                  {downloadProgress.status === 'downloading' && `Загружено ${downloadProgress.current} из ${downloadProgress.total}`}
                </p>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={onCancelDownload}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
