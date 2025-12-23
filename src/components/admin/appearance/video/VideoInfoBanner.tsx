import Icon from '@/components/ui/icon';

const VideoInfoBanner = () => {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
      <div className="flex gap-2">
        <Icon name="Zap" size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-blue-900 dark:text-blue-300">
          <p className="font-medium">Молниеносная загрузка через CDN:</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-400">
            <li>Видео сжимается до 720p с битрейтом 1.5 Mbps</li>
            <li>Загружается в облачное хранилище Yandex Cloud</li>
            <li>Раздается через CDN для мгновенной загрузки</li>
            <li>Рекомендуем: 10-30 секунд (будет зациклено)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VideoInfoBanner;
