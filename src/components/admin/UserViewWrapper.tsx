import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import Dashboard from '@/components/Dashboard';
import ClientsPage from '@/components/ClientsPage';
import PhotobookPage from '@/components/PhotobookPage';
import SettingsPage from '@/components/SettingsPage';
import TariffsPage from '@/components/TariffsPage';

interface UserViewWrapperProps {
  viewedUser: { userId: number; userEmail: string };
  onExit: () => void;
}

const UserViewWrapper = ({ viewedUser, onExit }: UserViewWrapperProps) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'clients' | 'photobook' | 'settings' | 'tariffs'>('dashboard');

  const handleNavigateToPhotoBank = () => {
    console.log('[USER_VIEW_WRAPPER] Navigating to photo bank for user:', viewedUser.userId);
    localStorage.setItem('admin_viewing_user_id', String(viewedUser.userId));
    console.log('[USER_VIEW_WRAPPER] Set admin_viewing_user_id to:', viewedUser.userId);
    navigate('/photo-bank');
  };

  return (
    <div className="space-y-4">
      {/* Фиксированный баннер о режиме просмотра */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Icon name="Eye" size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm">Режим просмотра активен</p>
                <p className="text-xs opacity-90">
                  Кабинет пользователя: {viewedUser.userEmail} (ID: {viewedUser.userId})
                </p>
              </div>
            </div>
            <Button
              onClick={onExit}
              variant="secondary"
              size="sm"
              className="bg-white text-orange-600 hover:bg-white/90"
            >
              <Icon name="X" size={16} className="mr-2" />
              Выйти из просмотра
            </Button>
          </div>
        </div>
      </div>

      {/* Навигация по страницам пользователя */}
      <Card className="border-2 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setCurrentPage('dashboard')}
              variant={currentPage === 'dashboard' ? 'default' : 'outline'}
              size="sm"
            >
              <Icon name="Home" size={16} className="mr-2" />
              Главная
            </Button>
            <Button
              onClick={() => setCurrentPage('clients')}
              variant={currentPage === 'clients' ? 'default' : 'outline'}
              size="sm"
            >
              <Icon name="Users" size={16} className="mr-2" />
              Клиенты
            </Button>
            <Button
              onClick={() => setCurrentPage('photobook')}
              variant={currentPage === 'photobook' ? 'default' : 'outline'}
              size="sm"
            >
              <Icon name="Book" size={16} className="mr-2" />
              Фотокниги
            </Button>
            <Button
              onClick={() => setCurrentPage('tariffs')}
              variant={currentPage === 'tariffs' ? 'default' : 'outline'}
              size="sm"
            >
              <Icon name="Zap" size={16} className="mr-2" />
              Тарифы
            </Button>
            <Button
              onClick={() => setCurrentPage('settings')}
              variant={currentPage === 'settings' ? 'default' : 'outline'}
              size="sm"
            >
              <Icon name="Settings" size={16} className="mr-2" />
              Настройки
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Контент страницы пользователя */}
      <div className="border-4 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/20">
        {currentPage === 'dashboard' && (
          <Dashboard
            userRole="user"
            userId={viewedUser.userId.toString()}
            isAdmin={false}
            onNavigateToPhotoBank={handleNavigateToPhotoBank}
          />
        )}
        {currentPage === 'clients' && <ClientsPage userId={viewedUser.userId.toString()} />}
        {currentPage === 'photobook' && <PhotobookPage />}
        {currentPage === 'tariffs' && (
          <TariffsPage isAdmin={false} userId={viewedUser.userId.toString()} />
        )}
        {currentPage === 'settings' && (
          <SettingsPage userId={viewedUser.userId} />
        )}
      </div>
    </div>
  );
};

export default UserViewWrapper;