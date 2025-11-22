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
    { icon: 'Images', label: 'Фото банк', path: '/photo-bank' },
    { icon: 'Users', label: 'Клиенты', path: '/clients' },
    { icon: 'Zap', label: 'Тарифы', path: '/tariffs' },
    { icon: 'Settings', label: 'Настройки', path: '/settings' },
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 md:hidden">
      <div className="flex justify-around items-center py-2 px-2">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            className={cn(
              'flex-1 flex flex-col items-center gap-1 h-auto py-2 px-1',
              isActive(item.path) && 'text-primary'
            )}
            onClick={() => handleNavClick(item)}
          >
            <Icon 
              name={item.icon} 
              size={20} 
              className={cn(isActive(item.path) && 'text-primary')}
            />
            <span className="text-xs">{item.label}</span>
          </Button>
        ))}
      </div>
    </nav>
  );
};

export default MobileNavigation;
