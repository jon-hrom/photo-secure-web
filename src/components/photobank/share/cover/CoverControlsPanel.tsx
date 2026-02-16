import Icon from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import { PageDesignSettings } from './types';

interface CoverControlsPanelProps {
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
}

export default function CoverControlsPanel({
  settings,
  onSettingsChange,
}: CoverControlsPanelProps) {
  const isVertical = settings.coverOrientation === 'vertical';

  const handleOrientationChange = (orientation: 'horizontal' | 'vertical') => {
    onSettingsChange({ ...settings, coverOrientation: orientation });
  };

  const handleGridGapChange = (value: number[]) => {
    onSettingsChange({ ...settings, gridGap: value[0] });
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Размер названия
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">{settings.coverFontSize}px</span>
        </div>
        <Slider
          value={[settings.coverFontSize]}
          onValueChange={(v) => onSettingsChange({ ...settings, coverFontSize: v[0] })}
          min={16}
          max={72}
          step={2}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">16px</span>
          <span className="text-xs text-gray-400">72px</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Отступ между фото в сетке
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">{settings.gridGap}px</span>
        </div>
        <Slider
          value={[settings.gridGap]}
          onValueChange={handleGridGapChange}
          min={0}
          max={24}
          step={1}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">0px</span>
          <span className="text-xs text-gray-400">24px</span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Ориентация обложки
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleOrientationChange('horizontal')}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
              !isVertical
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="w-8 h-5 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
              <Icon name="Image" size={12} className="text-gray-400" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Горизонтальная</span>
            {!isVertical && (
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon name="Check" size={10} className="text-white" />
              </div>
            )}
          </button>
          <button
            onClick={() => handleOrientationChange('vertical')}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
              isVertical
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="w-5 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
              <Icon name="Image" size={10} className="text-gray-400" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Вертикальная</span>
            {isVertical && (
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon name="Check" size={10} className="text-white" />
              </div>
            )}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Положение названия на обложке
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: 'top-center' as const, label: 'Сверху' },
            { key: 'center' as const, label: 'Центр' },
            { key: 'bottom-left' as const, label: 'Лево' },
            { key: 'bottom-center' as const, label: 'Низ' },
            { key: 'bottom-right' as const, label: 'Право' },
          ]).map(pos => (
            <button
              key={pos.key}
              onClick={() => onSettingsChange({ ...settings, coverTextPosition: pos.key })}
              className={`px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                settings.coverTextPosition === pos.key
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-600 dark:text-gray-400'
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
