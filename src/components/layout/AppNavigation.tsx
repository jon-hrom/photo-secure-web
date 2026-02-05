import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface AppNavigationProps {
  currentPage: 'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin' | 'tariffs' | 'help';
  setCurrentPage: (page: 'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin' | 'tariffs' | 'help') => void;
  userName: string;
  userEmail: string;
  userAvatar: string;
  isVerified: boolean;
  hasVerifiedPhone?: boolean;
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
    <nav className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-border/50 dark:border-gray-700/50 sticky top-0 z-50 shadow-lg animate-fade-in">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-3 group cursor-pointer">
              <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Icon name="Camera" className="text-white" size={28} />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent animate-glow">
                Foto-Mix
              </h1>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={currentPage === 'dashboard' ? 'default' : 'ghost'}
                  className={cn(
                    "rounded-full transition-all duration-300 hover:scale-105",
                    currentPage === 'dashboard' && "bg-gradient-to-r from-primary to-secondary shadow-lg"
                  )}
                  data-tour="dashboard"
                >
                  <Icon name="Home" size={18} className="mr-2" />
                  Главная
                  <Icon name="ChevronDown" size={16} className="ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 animate-scale-in backdrop-blur-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-border/50 dark:border-gray-700/50 shadow-xl">
                <DropdownMenuItem onClick={() => setCurrentPage('dashboard')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="LayoutDashboard" size={18} className="mr-2" />
                  Главная
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentPage('clients')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200" data-tour="clients-nav">
                  <Icon name="Users" size={18} className="mr-2" />
                  Клиенты
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/statistics')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="BarChart3" size={18} className="mr-2" />
                  Статистика
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentPage('photobook')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200" data-tour="photobook-nav">
                  <Icon name="Book" size={18} className="mr-2" />
                  Фотокниги
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  console.log('[APP_NAV] Navigating to photo-bank from dropdown');
                  navigate('/photo-bank');
                }} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="Images" size={18} className="mr-2" />
                  Мой фото банк
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentPage('tariffs')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="Zap" size={18} className="mr-2" />
                  Тарифы
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="Settings" size={18} className="mr-2" />
                  Настройки
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={() => setCurrentPage('help')}
              className="hidden md:flex rounded-full hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-300"
              title="Справка"
            >
              <Icon name="HelpCircle" size={20} />
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/settings')}
              className="hidden md:flex rounded-full border-2 border-primary/50 hover:border-primary hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-300 hover:scale-105 hover:shadow-lg"
              data-tour="settings-nav"
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
                      className="w-8 h-8 rounded-full border border-gray-200 object-cover"
                    />
                  ) : (
                    <Icon name="User" size={20} />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-border/50 dark:border-gray-700/50">
                {userName && (
                  <div className="px-2 py-2 border-b dark:border-gray-700">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-sm font-medium dark:text-gray-200">{userName}</p>
                      {isVerified && (
                        <Icon name="BadgeCheck" size={16} className="text-blue-500" />
                      )}
                    </div>
                    {userEmail && <p className="text-xs text-gray-500 dark:text-gray-400">{userEmail}</p>}
                  </div>
                )}
                <DropdownMenuItem onClick={() => navigate('/settings')} className="md:hidden dark:text-gray-200">
                  <Icon name="Settings" size={18} className="mr-2" />
                  Настройки
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} className="dark:text-gray-200">
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