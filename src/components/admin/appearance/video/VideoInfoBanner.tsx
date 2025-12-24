import Icon from '@/components/ui/icon';

const VideoInfoBanner = () => {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
      <div className="flex gap-2">
        <Icon name="Zap" size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-blue-900 dark:text-blue-300">
          <p className="font-medium">Рекомендации для видео:</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-400">
            <li><strong>Длительность:</strong> 5-15 секунд (будет зациклено)</li>
            <li><strong>Размер файла:</strong> до 5 MB (для быстрой загрузки)</li>
            <li><strong>Разрешение:</strong> 1920x1080 или меньше</li>
            <li><strong>Формат:</strong> MP4, WebM (H.264/VP9 кодек)</li>
            <li>Загружается в Yandex Cloud и раздается через CDN</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VideoInfoBanner;