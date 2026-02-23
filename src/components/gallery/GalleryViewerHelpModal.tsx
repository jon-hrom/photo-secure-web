import Icon from '@/components/ui/icon';

interface GalleryViewerHelpModalProps {
  onClose: () => void;
  downloadDisabled: boolean;
  hasDownload: boolean;
}

export default function GalleryViewerHelpModal({ onClose, downloadDisabled, hasDownload }: GalleryViewerHelpModalProps) {
  return (
    <div
      className="absolute inset-0 z-[100] flex items-end sm:items-center justify-center overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.85)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md sm:mx-4 flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Управление просмотром</h3>
            <p className="text-xs text-gray-500 mt-0.5">Жесты и кнопки</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200">
            <Icon name="X" size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Прокручиваемый список */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-1">

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Жесты</p>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Icon name="ArrowLeftRight" size={20} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Свайп влево / вправо</p>
              <p className="text-xs text-gray-500 mt-0.5">Переключение между фотографиями</p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <Icon name="Hand" size={20} className="text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Один тап по экрану</p>
              <p className="text-xs text-gray-500 mt-0.5">Скрыть или показать все кнопки управления</p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Icon name="ZoomIn" size={20} className="text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Два пальца (pinch)</p>
              <p className="text-xs text-gray-500 mt-0.5">Сведите или разведите пальцы для точного масштабирования фото</p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Icon name="Move" size={20} className="text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Перетаскивание пальцем</p>
              <p className="text-xs text-gray-500 mt-0.5">Когда фото увеличено — перемещайте его по экрану</p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <Icon name="Smartphone" size={20} className="text-teal-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Поворот телефона горизонтально</p>
              <p className="text-xs text-gray-500 mt-0.5">Автоматически включает полноэкранный режим, скрывает все кнопки</p>
            </div>
          </div>

          <div className="h-px bg-gray-100 my-3" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Кнопки</p>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <Icon name="X" size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Крестик — правый верхний угол</p>
              <p className="text-xs text-gray-500 mt-0.5">Закрыть просмотр фотографии</p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <Icon name="Maximize2" size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Развернуть — правый нижний угол</p>
              <p className="text-xs text-gray-500 mt-0.5">Открыть полноэкранный режим поверх браузера. Повторное нажатие — выход</p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <Icon name="Minimize2" size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Свернуть — правый верхний угол</p>
              <p className="text-xs text-gray-500 mt-0.5">Выйти из полноэкранного режима (появляется когда экран развёрнут)</p>
            </div>
          </div>

          {!downloadDisabled && hasDownload && (
            <div className="flex items-start gap-3 py-2.5">
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
                <Icon name="Download" size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">Скачать — верхний правый угол</p>
                <p className="text-xs text-gray-500 mt-0.5">Сохранить текущее фото на устройство. Можно выбрать веб-версию или оригинал в полном качестве</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <Icon name="ZoomOut" size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Сбросить масштаб — верхний правый угол</p>
              <p className="text-xs text-gray-500 mt-0.5">Вернуть фото к исходному размеру (появляется только когда фото увеличено)</p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <Icon name="ChevronLeft" size={20} className="text-white" />
              <Icon name="ChevronRight" size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Стрелки — левый и правый край</p>
              <p className="text-xs text-gray-500 mt-0.5">Переключение между фотографиями нажатием</p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <Icon name="HelpCircle" size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Справка — верхний правый угол</p>
              <p className="text-xs text-gray-500 mt-0.5">Открыть это окно с подсказками</p>
            </div>
          </div>

        </div>

        {/* Кнопка */}
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full bg-gray-900 active:bg-black text-white font-semibold rounded-xl transition-colors touch-manipulation"
            style={{ minHeight: 50 }}
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
