import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: string;
  label: string;
  path: string;
  badge?: string | number;
}

interface PageNavigationProps {
  onNavigate?: (page: string) => void;
  className?: string;
}

const PageNavigation = ({ onNavigate, className }: PageNavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { icon: 'LayoutDashboard', label: 'Главная', path: '/' },
    { icon: 'Settings', label: 'Настройки', path: '/settings' },
    { icon: 'Images', label: 'Фото банк', path: '/photo-bank' },
    { icon: 'Users', label: 'Клиенты', path: '/clients' },
    { icon: 'Book', label: 'Фотокниги', path: '/photobook' },
    { icon: 'Zap', label: 'Тарифы', path: '/tariffs' },
  ];

  const handleNavClick = (item: NavItem) => {
    if (item.path === '/') {
      if (onNavigate) {
        onNavigate('dashboard');
      } else {
        navigate('/');
      }
    } else if (item.path === '/photo-bank') {
      navigate('/photo-bank');
    } else if (item.path === '/clients') {
      if (onNavigate) {
        onNavigate('clients');
      } else {
        navigate('/');
      }
    } else if (item.path === '/photobook') {
      if (onNavigate) {
        onNavigate('photobook');
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
    <nav className={cn('bg-white border-r border-border h-full', className)}>
      <div className="p-4 space-y-2">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant={isActive(item.path) ? 'default' : 'ghost'}
            className={cn(
              'w-full justify-start gap-3',
              isActive(item.path) && 'bg-primary text-primary-foreground'
            )}
            onClick={() => handleNavClick(item)}
          >
            <Icon name={item.icon} size={20} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </Button>
        ))}
      </div>
    </nav>
  );
};

export default PageNavigation;