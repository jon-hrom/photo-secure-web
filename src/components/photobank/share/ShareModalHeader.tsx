import Icon from '@/components/ui/icon';

interface ShareModalHeaderProps {
  activeTab: 'design' | 'link' | 'favorites' | 'features';
  onTabChange: (tab: 'design' | 'link' | 'favorites' | 'features') => void;
  onClose: () => void;
}

export default function ShareModalHeader({ activeTab, onTabChange, onClose }: ShareModalHeaderProps) {
  return (
    <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-800 z-10">
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Ссылка на папку</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Закрыть"
        >
          <Icon name="X" size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
      </div>
      
      <div className="flex border-t dark:border-gray-800">
        <button
          onClick={() => onTabChange('design')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'design'
              ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Icon name="Palette" size={16} className="inline mr-1.5" />
          <span className="hidden sm:inline">Настройка страницы</span>
          <span className="sm:hidden">Дизайн</span>
        </button>
        <button
          onClick={() => onTabChange('link')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'link'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Icon name="Link" size={16} className="inline mr-1.5" />
          Ссылка
        </button>
        <button
          onClick={() => onTabChange('favorites')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'favorites'
              ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Icon name="Star" size={16} className="inline mr-1.5" />
          <span className="hidden sm:inline">Избранное</span>
          <span className="sm:hidden">Изб.</span>
        </button>
        <button
          onClick={() => onTabChange('features')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'features'
              ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Icon name="Settings2" size={16} className="inline mr-1.5" />
          <span className="hidden sm:inline">Возможности</span>
          <span className="sm:hidden">Доп.</span>
        </button>
      </div>
    </div>
  );
}