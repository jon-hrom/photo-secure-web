import Icon from '@/components/ui/icon';

interface YandexDiskProgressProps {
  show: boolean;
  percent: number;
  done: number;
  total: number;
}

export default function YandexDiskProgress({ show, percent, done, total }: YandexDiskProgressProps) {
  if (!show) return null;

  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl">
        <div className="relative w-32 h-32 mx-auto mb-5">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="#FC3F1D"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{percent}%</span>
            <Icon name="HardDriveUpload" size={18} className="text-[#FC3F1D] mt-1 animate-pulse" />
          </div>
        </div>
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">
          Загрузка на Яндекс.Диск
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {total > 0 ? `Обработано ${done} из ${total} фото` : 'Подготовка...'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Не закрывайте страницу до завершения
        </p>
      </div>
    </div>
  );
}
