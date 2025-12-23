import Icon from '@/components/ui/icon';

interface ThemeSectionProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

const ThemeSection = ({ theme, onThemeChange }: ThemeSectionProps) => {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Оформление</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Тема интерфейса</label>
          <div className="flex gap-3">
            <button
              onClick={() => onThemeChange('light')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                theme === 'light'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <Icon name="Sun" size={20} />
              <span className="font-medium">Светлая</span>
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                theme === 'dark'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <Icon name="Moon" size={20} />
              <span className="font-medium">Тёмная</span>
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Изменения применяются мгновенно
          </p>
        </div>
      </div>
    </section>
  );
};

export default ThemeSection;
