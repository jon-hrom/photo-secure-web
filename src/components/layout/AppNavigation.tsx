import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppNavigationProps {
  currentPage: 'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin';
  setCurrentPage: (page: 'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin') => void;
  userName: string;
  userEmail: string;
  userAvatar: string;
  isVerified: boolean;
  onLogout: () => void;
}

const AppNavigation = ({
  currentPage,
  setCurrentPage,
  userName,
  userEmail,
  userAvatar,
  isVerified,
  onLogout
}: AppNavigationProps) => {
  const navigate = useNavigate();
  
  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon name="Camera" className="text-primary" size={32} />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Foto-Mix
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            {userAvatar && (
              <div className="flex items-center space-x-3 mr-2">
                <div className="relative">
                  <img 
                    src={userAvatar} 
                    alt={userName}
                    className="w-10 h-10 rounded-full border-2 border-primary shadow-sm"
                  />
                  {isVerified && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5">
                      <Icon name="Check" size={12} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="hidden md:block">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-700">
                      {userName}
                    </span>
                    {isVerified && (
                      <Icon name="BadgeCheck" size={16} className="text-blue-500" />
                    )}
                  </div>
                </div>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={currentPage === 'dashboard' ? 'default' : 'ghost'}
                  className="rounded-full"
                >
                  <Icon name="Home" size={18} className="mr-2" />
                  Главная
                  <Icon name="ChevronDown" size={16} className="ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/')}>
                  <Icon name="LayoutDashboard" size={18} className="mr-2" />
                  Главная
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/clients')}>
                  <Icon name="Users" size={18} className="mr-2" />
                  Клиенты
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/photobooks')}>
                  <Icon name="Book" size={18} className="mr-2" />
                  Фотокниги
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/photo-bank')}>
                  <Icon name="Images" size={18} className="mr-2" />
                  Мой фото банк
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/features')}>
                  <Icon name="Sparkles" size={18} className="mr-2" />
                  Возможности сервиса
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={() => navigate('/upgrade-plan')}
              className="rounded-full border-2 border-green-500 hover:bg-green-50"
            >
              <Icon name="Zap" size={18} className="mr-2" />
              Тарифы
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage('settings')}
              className="rounded-full border-2 border-primary"
            >
              <Icon name="Settings" size={18} className="mr-2" />
              Настройки
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full px-2"
                >
                  {userAvatar ? (
                    <img 
                      src={userAvatar} 
                      alt={userName}
                      className="w-8 h-8 rounded-full border border-gray-200"
                    />
                  ) : (
                    <Icon name="User" size={20} />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {userName && (
                  <div className="px-2 py-2 border-b">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-sm font-medium">{userName}</p>
                      {isVerified && (
                        <Icon name="BadgeCheck" size={16} className="text-blue-500" />
                      )}
                    </div>
                    {userEmail && <p className="text-xs text-gray-500">{userEmail}</p>}
                  </div>
                )}
                <DropdownMenuItem onClick={onLogout}>
                  <Icon name="LogOut" size={18} className="mr-2" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default AppNavigation;