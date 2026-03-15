import Icon from '@/components/ui/icon';

interface GalleryViewerHelpModalProps {
  onClose: () => void;
  downloadDisabled: boolean;
  hasDownload: boolean;
}

const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function HelpItem({ icon, iconBg, iconColor, title, desc }: {
  icon: string; iconBg: string; iconColor: string; title: string; desc: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon name={icon} size={20} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function ButtonItem({ icon, title, desc, secondIcon }: {
  icon: string; title: string; desc: string; secondIcon?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
        <Icon name={icon} size={18} className="text-white" />
        {secondIcon && <Icon name={secondIcon} size={18} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function MobileHelp({ downloadDisabled, hasDownload }: { downloadDisabled: boolean; hasDownload: boolean }) {
  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Жесты</p>

      <HelpItem
        icon="ArrowLeftRight" iconBg="bg-blue-50" iconColor="text-blue-500"
        title="Свайп влево / вправо"
        desc="Переключение между фотографиями"
      />
      <HelpItem
        icon="Hand" iconBg="bg-gray-50" iconColor="text-gray-500"
        title="Один тап по экрану"
        desc="Скрыть или показать все кнопки управления"
      />
      <HelpItem
        icon="ZoomIn" iconBg="bg-violet-50" iconColor="text-violet-500"
        title="Два пальца (pinch)"
        desc="Сведите или разведите пальцы для увеличения фото"
      />
      <HelpItem
        icon="Move" iconBg="bg-orange-50" iconColor="text-orange-500"
        title="Перетаскивание пальцем"
        desc="Когда фото увеличено — перемещайте его по экрану"
      />
      <HelpItem
        icon="Smartphone" iconBg="bg-teal-50" iconColor="text-teal-500"
        title="Поворот телефона"
        desc="Горизонтальный режим включает полноэкранный просмотр"
      />

      <div className="h-px bg-gray-100 my-3" />
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Кнопки</p>

      <ButtonItem icon="X" title="Крестик" desc="Закрыть просмотр фотографии" />
      <ButtonItem icon="Maximize2" title="Развернуть" desc="Открыть полноэкранный режим" />

      {!downloadDisabled && hasDownload && (
        <ButtonItem icon="Download" title="Скачать" desc="Сохранить фото на устройство" />
      )}

      <ButtonItem icon="ZoomOut" title="Сбросить масштаб" desc="Вернуть фото к исходному размеру (при увеличении)" />
      <ButtonItem icon="HelpCircle" title="Справка" desc="Открыть это окно с подсказками" />
    </>
  );
}

function DesktopHelp({ downloadDisabled, hasDownload }: { downloadDisabled: boolean; hasDownload: boolean }) {
  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Клавиатура</p>

      <HelpItem
        icon="ArrowLeft" iconBg="bg-blue-50" iconColor="text-blue-500"
        title="Стрелки ← →"
        desc="Переключение между фотографиями"
      />
      <HelpItem
        icon="LogOut" iconBg="bg-gray-50" iconColor="text-gray-500"
        title="Escape"
        desc="Закрыть просмотр или выйти из полноэкранного режима"
      />

      <div className="h-px bg-gray-100 my-3" />
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Мышь</p>

      <HelpItem
        icon="MousePointerClick" iconBg="bg-violet-50" iconColor="text-violet-500"
        title="Клик по фото"
        desc="Скрыть или показать панель управления"
      />
      <HelpItem
        icon="ArrowLeftRight" iconBg="bg-indigo-50" iconColor="text-indigo-500"
        title="Стрелки по краям экрана"
        desc="Нажмите стрелку слева или справа для навигации"
      />
      <HelpItem
        icon="Move" iconBg="bg-orange-50" iconColor="text-orange-500"
        title="Перетаскивание мышью"
        desc="При увеличении — зажмите и перемещайте фото"
      />

      <div className="h-px bg-gray-100 my-3" />
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Кнопки</p>

      <ButtonItem icon="X" title="Крестик — правый верхний угол" desc="Закрыть просмотр фотографии" />
      <ButtonItem icon="Maximize2" title="Развернуть — правый нижний угол" desc="Открыть полноэкранный режим поверх браузера" />
      <ButtonItem icon="Minimize2" title="Свернуть — правый верхний угол" desc="Выйти из полноэкранного режима" />

      {!downloadDisabled && hasDownload && (
        <ButtonItem icon="Download" title="Скачать — верхний правый угол" desc="Сохранить фото — можно выбрать веб-версию или оригинал" />
      )}

      <ButtonItem icon="ZoomOut" title="Сбросить масштаб" desc="Вернуть фото к исходному размеру (появляется при увеличении)" />
      <ButtonItem icon="ChevronLeft" title="Стрелки навигации" desc="Переключение между фотографиями по краям экрана" secondIcon="ChevronRight" />
      <ButtonItem icon="HelpCircle" title="Справка" desc="Открыть это окно с подсказками" />
    </>
  );
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
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {isMobileDevice ? 'Как просматривать фото' : 'Управление просмотром'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isMobileDevice ? 'Жесты и кнопки на вашем устройстве' : 'Клавиатура, мышь и кнопки'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200">
            <Icon name="X" size={16} className="text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-1">
          {isMobileDevice
            ? <MobileHelp downloadDisabled={downloadDisabled} hasDownload={hasDownload} />
            : <DesktopHelp downloadDisabled={downloadDisabled} hasDownload={hasDownload} />
          }
        </div>

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
