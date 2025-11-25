import { useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems: NavItem[] = [
    { icon: 'LayoutDashboard', label: 'Главная', path: '/' },
    { icon: 'Settings', label: 'Настройки', path: '/settings' },
    { icon: 'Images', label: 'Фото банк', path: '/photo-bank' },
    { icon: 'Users', label: 'Клиенты', path: '/clients' },
    { icon: 'Zap', label: 'Тарифы', path: '/tariffs' },
  ];

  const handleNavClick = (item: NavItem) => {
    if (item.path === '/') {
      setIsExpanded(!isExpanded);
      return;
    }

    setIsExpanded(false);
    
    if (item.path === '/clients') {
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
    <>
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="flex flex-col items-start justify-end pb-4 px-4 gap-2">
          {isExpanded && navItems.slice(1).reverse().map((item, index) => (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                'flex flex-col items-center gap-1 h-auto py-3 px-4 relative bg-white/90 backdrop-blur-xl border-2 border-border/50 shadow-2xl hover:shadow-3xl',
                isActive(item.path) && 'border-primary/50'
              )}
              onClick={() => handleNavClick(item)}
              style={{
                animation: `slide-in-from-bottom 0.4s ease-out ${index * 0.1}s both`,
                transformOrigin: 'bottom center'
              }}
            >
              {isActive(item.path) && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl" />
              )}
              <div className={cn(
                'p-3 rounded-xl transition-all duration-300 relative',
                isActive(item.path) ? 'bg-gradient-to-br from-primary to-secondary shadow-lg' : 'hover:bg-gray-100'
              )}>
                <Icon 
                  name={item.icon} 
                  size={24} 
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
            </Button>
          ))}

          <Button
            variant="ghost"
            className={cn(
              'flex flex-col items-center gap-1 h-auto py-3 px-4 transition-all duration-300 relative backdrop-blur-xl border-2 shadow-2xl hover:shadow-3xl',
              isExpanded 
                ? 'bg-white/90 border-border/50' 
                : 'bg-white/40 border-white/30 hover:bg-white/50',
              isActive('/') && 'border-primary/50'
            )}
            onClick={() => handleNavClick(navItems[0])}
          >
            {isActive('/') && (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl" />
            )}
            <div className={cn(
              'p-3 rounded-xl transition-all duration-300 relative',
              isActive('/') ? 'bg-gradient-to-br from-primary to-secondary shadow-lg' : 'hover:bg-gray-100/50'
            )}>
              <Icon 
                name={navItems[0].icon} 
                size={24} 
                className={cn(
                  'transition-colors duration-300',
                  isActive('/') ? 'text-white' : 'text-gray-600'
                )}
              />
            </div>
            <span className={cn(
              'text-xs font-medium transition-all duration-300',
              isActive('/') ? 'text-primary font-bold' : 'text-gray-600'
            )}>
              {navItems[0].label}
            </span>
          </Button>
        </div>
      </nav>
    </>
  );
};

export default MobileNavigation;