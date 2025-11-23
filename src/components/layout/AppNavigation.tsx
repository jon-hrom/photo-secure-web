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
  currentPage: 'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin' | 'tariffs';
  setCurrentPage: (page: 'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin' | 'tariffs') => void;
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
    <nav className="bg-white/90 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50 shadow-lg animate-fade-in">
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
                >
                  <Icon name="Home" size={18} className="mr-2" />
                  Главная
                  <Icon name="ChevronDown" size={16} className="ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 animate-scale-in backdrop-blur-xl bg-white/95 border-border/50 shadow-xl">
                <DropdownMenuItem onClick={() => setCurrentPage('dashboard')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200">
                  <Icon name="LayoutDashboard" size={18} className="mr-2" />
                  Главная
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentPage('clients')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200">
                  <Icon name="Users" size={18} className="mr-2" />
                  Клиенты
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentPage('photobook')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200">
                  <Icon name="Book" size={18} className="mr-2" />
                  Фотокниги
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/photo-bank')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200">
                  <Icon name="Images" size={18} className="mr-2" />
                  Мой фото банк
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentPage('tariffs')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200">
                  <Icon name="Zap" size={18} className="mr-2" />
                  Тарифы
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            
            <Button
              variant="outline"
              onClick={() => setCurrentPage('settings')}
              className="hidden md:flex rounded-full border-2 border-primary/50 hover:border-primary hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-300 hover:scale-105 hover:shadow-lg"
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