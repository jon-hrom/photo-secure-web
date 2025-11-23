import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

interface MobileNavigationProps {
  onNavigate?: (page: string) => void;
}

const MobileNavigation = ({ onNavigate }: MobileNavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { icon: 'LayoutDashboard', label: 'Главная', path: '/' },
    { icon: 'Settings', label: 'Настройки', path: '/settings' },
    { icon: 'Images', label: 'Фото банк', path: '/photo-bank' },
    { icon: 'Users', label: 'Клиенты', path: '/clients' },
    { icon: 'Zap', label: 'Тарифы', path: '/tariffs' },
  ];

  const handleNavClick = (item: NavItem) => {
    if (item.path === '/') {
      if (onNavigate) {
        onNavigate('dashboard');
      } else {
        navigate('/');
      }
    } else if (item.path === '/clients') {
      if (onNavigate) {
        onNavigate('clients');
      } else {
        navigate('/');
      }
    } else if (item.path === '/tariffs') {
      if (onNavigate) {
        onNavigate('tariffs');
      } else {
        navigate('/');
      }
    } else if (item.path === '/settings') {
      if (onNavigate) {
        onNavigate('settings');
      } else {
        navigate('/');
      }
    } else {
      navigate(item.path);
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-border/50 z-50 md:hidden animate-slide-up shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex justify-around items-center py-2 px-2">
        {navItems.map((item, index) => (
          <Button
            key={item.path}
            variant="ghost"
            className={cn(
              'flex-1 flex flex-col items-center gap-1 h-auto py-3 px-1 transition-all duration-300 relative',
              isActive(item.path) && 'text-primary scale-110'
            )}
            onClick={() => handleNavClick(item)}
            style={{ 
              animationDelay: `${index * 50}ms`,
              animation: 'fade-in-up 0.4s ease-out forwards'
            }}
          >
            {isActive(item.path) && (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl" />
            )}
            <div className={cn(
              'p-2 rounded-xl transition-all duration-300 relative',
              isActive(item.path) ? 'bg-gradient-to-br from-primary to-secondary shadow-lg' : 'hover:bg-gray-100'
            )}>
              <Icon 
                name={item.icon} 
                size={20} 
                className={cn(
                  'transition-colors duration-300',
                  isActive(item.path) ? 'text-white' : 'text-gray-600'
                )}
              />
            </div>
            <span className={cn(
              'text-xs font-medium transition-all duration-300',
              isActive(item.path) ? 'text-primary font-bold' : 'text-gray-600'
            )}>
              {item.label}
            </span>
            {isActive(item.path) && (
              <div className="absolute -top-1 w-12 h-1 bg-gradient-to-r from-primary to-secondary rounded-full shadow-lg" />
            )}
          </Button>
        ))}
      </div>
    </nav>
  );
};

export default MobileNavigation;