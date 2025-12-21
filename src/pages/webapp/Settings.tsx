import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useEffect } from 'react';
import MobileNavigation from '@/components/layout/MobileNavigation';

const Settings = () => {
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const maxBlocks = document.querySelectorAll('[data-max-connection-card], .max-connection-card, section:has(h2:contains("MAX"))');
      maxBlocks.forEach(block => {
        if (block && (block.textContent?.includes('MAX') || block.textContent?.includes('Мессенджер'))) {
          (block as HTMLElement).style.display = 'none';
        }
      });
      
      const allSections = document.querySelectorAll('section');
      allSections.forEach(section => {
        const heading = section.querySelector('h2');
        if (heading?.textContent?.includes('MAX')) {
          (section as HTMLElement).style.display = 'none';
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Настройки</h1>
        
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Профиль</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Имя пользователя</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Введите имя"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Уведомления</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" className="w-4 h-4 text-primary rounded" />
                <span className="text-gray-700">Уведомления по email</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="w-4 h-4 text-primary rounded" />
                <span className="text-gray-700">Push-уведомления</span>
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Безопасность</h2>
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <Icon name="Lock" size={18} />
              Изменить пароль
            </Button>
          </section>

          <div className="pt-4 border-t">
            <Button className="w-full">Сохранить изменения</Button>
          </div>
        </div>
      </div>
    </div>
    <MobileNavigation />
    </>
  );
};

export default Settings;