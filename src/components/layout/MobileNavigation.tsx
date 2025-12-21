import { useState, useRef, useEffect } from 'react';
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
  currentPage?: string;
}

const MobileNavigation = ({ onNavigate, currentPage }: MobileNavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(16);
  const navRef = useRef<HTMLDivElement>(null);

  const navItems: NavItem[] = [
    { icon: 'LayoutDashboard', label: 'МЕНЮ', path: '/' },
    { icon: 'Home', label: 'Главная', path: '/' },
    { icon: 'BookOpen', label: 'Справка', path: '/help' },
    { icon: 'Settings', label: 'Настройки', path: '/settings' },
    { icon: 'Zap', label: 'Тарифы', path: '/tariffs' },
    { icon: 'Images', label: 'Фото банк', path: '/photo-bank' },
    { icon: 'Users', label: 'Клиенты', path: '/clients' },
  ];
  
  const getNavClassName = (path: string) => {
    if (path === '/photo-bank') return 'mobile-nav-photobank';
    if (path === '/settings') return 'mobile-nav-settings';
    return '';
  };

  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const handleMenuClick = () => {
    vibrate(isExpanded ? 30 : [20, 10, 20]);
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    if (isExpanded && navRef.current) {
      const navHeight = navRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      const requiredSpace = navHeight + 16;
      
      if (requiredSpace > windowHeight) {
        setBottomOffset(Math.max(0, windowHeight - navHeight - 16));
      } else {
        setBottomOffset(16);
      }
    } else {
      setBottomOffset(16);
    }
  }, [isExpanded]);

  const handleNavClick = (item: NavItem) => {
    vibrate(15);
    setIsExpanded(false);
    
    if (item.path.startsWith('/')) {
      navigate(item.path);
    } else if (onNavigate) {
      onNavigate(item.path);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <>
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      <nav 
        ref={navRef}
        className="fixed left-0 right-0 z-50 md:hidden transition-all duration-300"
        style={{
          bottom: `${bottomOffset}px`
        }}
      >
        <div className="flex flex-col items-start justify-end pb-4 px-4 gap-2">
          {isExpanded && navItems.slice(1).reverse().map((item, index) => (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                'flex flex-col items-center gap-0.5 h-auto py-2 px-3 relative bg-white/90 backdrop-blur-xl border-2 border-border/50 shadow-2xl hover:shadow-3xl',
                isActive(item.path) && 'border-primary/50',
                getNavClassName(item.path)
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
                'p-2 rounded-lg transition-all duration-300 relative',
                isActive(item.path) ? 'bg-gradient-to-br from-primary to-secondary shadow-lg animate-pulse-active' : 'hover:bg-gray-100'
              )}>
                <Icon 
                  name={item.icon} 
                  size={18} 
                  className={cn(
                    'transition-colors duration-300',
                    isActive(item.path) ? 'text-white' : 'text-gray-600'
                  )}
                />
              </div>
              <span className={cn(
                'text-[10px] font-medium transition-all duration-300',
                isActive(item.path) ? 'text-primary font-bold' : 'text-gray-600'
              )}>
                {item.label}
              </span>
            </Button>
          ))}

          <Button
            variant="ghost"
            className={cn(
              'flex flex-col items-center gap-0.5 h-auto py-2 px-3 transition-all duration-300 relative backdrop-blur-sm border-2 shadow-2xl hover:shadow-3xl touch-none select-none',
              isExpanded 
                ? 'bg-white/90 border-border/50' 
                : 'bg-white/20 border-white/20 hover:bg-white/30',
              isActive('dashboard') && 'border-primary/50'
            )}
            onClick={handleMenuClick}
            onTouchStart={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          >
            {isActive('dashboard') && (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl" />
            )}
            <div className="absolute -top-1.5 -right-1.5 p-0.5 bg-gradient-to-br from-primary to-secondary rounded-full shadow-lg">
              <Icon 
                name="ChevronUp" 
                size={12} 
                className={cn(
                  'text-white transition-transform duration-300',
                  isExpanded ? 'rotate-180' : 'rotate-0'
                )}
              />
            </div>
            <div className={cn(
              'p-2 rounded-lg transition-all duration-300 relative',
              isActive('dashboard') ? 'bg-gradient-to-br from-primary to-secondary shadow-lg animate-pulse-active' : 'hover:bg-gray-100/50'
            )}>
              <Icon 
                name={navItems[0].icon} 
                size={18} 
                className={cn(
                  'transition-colors duration-300',
                  isActive('dashboard') ? 'text-white' : 'text-gray-600'
                )}
              />
            </div>
            <span className={cn(
              'text-[10px] font-medium transition-all duration-300',
              isActive('dashboard') ? 'text-primary font-bold' : 'text-gray-600'
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