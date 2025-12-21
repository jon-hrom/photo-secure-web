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
  const [userBottomPosition, setUserBottomPosition] = useState(16);
  const [isDragging, setIsDragging] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartBottom = useRef(16);
  const dragStartTime = useRef(0);

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
    if (!isDragging) {
      vibrate(isExpanded ? 30 : [20, 10, 20]);
      setIsExpanded(!isExpanded);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    dragStartY.current = e.touches[0].clientY;
    dragStartBottom.current = userBottomPosition;
    dragStartTime.current = Date.now();
    setIsDragging(false);
    
    document.body.style.overscrollBehavior = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentY = e.touches[0].clientY;
    const deltaY = dragStartY.current - currentY;
    
    if (Math.abs(deltaY) > 5) {
      setIsDragging(true);
      const windowHeight = window.innerHeight;
      const headerHeight = 180;
      const buttonHeight = 80;
      const maxBottom = windowHeight - headerHeight - buttonHeight;
      const newBottom = dragStartBottom.current + deltaY;
      const clampedBottom = Math.max(16, Math.min(maxBottom, newBottom));
      setUserBottomPosition(clampedBottom);
      setBottomOffset(clampedBottom);
    }
  };

  const handleTouchEnd = () => {
    const touchDuration = Date.now() - dragStartTime.current;
    
    document.body.style.overscrollBehavior = '';
    
    if (!isDragging && touchDuration < 300) {
      handleMenuClick();
    }
    
    setTimeout(() => setIsDragging(false), 100);
  };

  useEffect(() => {
    if (isExpanded && navRef.current) {
      const navHeight = navRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      const headerHeight = 180;
      const minTopSpace = headerHeight + 16;
      
      const maxAllowedBottom = windowHeight - navHeight - 16;
      const minAllowedBottom = windowHeight - navHeight - minTopSpace;
      
      if (userBottomPosition > maxAllowedBottom) {
        setBottomOffset(maxAllowedBottom);
      } else if (windowHeight - userBottomPosition - navHeight < minTopSpace) {
        setBottomOffset(Math.max(16, minAllowedBottom));
      } else {
        setBottomOffset(userBottomPosition);
      }
    } else {
      setBottomOffset(userBottomPosition);
    }
  }, [isExpanded, userBottomPosition]);

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
        className="fixed left-0 right-0 z-50 md:hidden"
        style={{
          bottom: `${bottomOffset}px`,
          transition: isDragging ? 'none' : 'bottom 0.3s ease-out'
        }}
      >
        <div className="flex flex-col items-start justify-end pb-4 px-4 gap-2">
          {isExpanded && navItems.slice(1).reverse().map((item, index) => (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                'flex flex-col items-center gap-0.5 h-auto py-2 px-3 relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-2 border-border/50 dark:border-gray-700/50 shadow-2xl hover:shadow-3xl',
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
                isActive(item.path) ? 'bg-gradient-to-br from-primary to-secondary shadow-lg animate-pulse-active' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              )}>
                <Icon 
                  name={item.icon} 
                  size={18} 
                  className={cn(
                    'transition-colors duration-300',
                    isActive(item.path) ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                  )}
                />
              </div>
              <span className={cn(
                'text-[10px] font-medium transition-all duration-300',
                isActive(item.path) ? 'text-primary font-bold' : 'text-gray-600 dark:text-gray-300'
              )}>
                {item.label}
              </span>
            </Button>
          ))}

          <Button
            variant="ghost"
            className={cn(
              'flex flex-col items-center gap-0.5 h-auto py-2 px-3 transition-all duration-300 relative backdrop-blur-sm border-2 shadow-2xl hover:shadow-3xl select-none cursor-grab active:cursor-grabbing touch-none',
              isExpanded 
                ? 'bg-white/90 dark:bg-gray-800/90 border-border/50 dark:border-gray-700/50' 
                : 'bg-white/20 dark:bg-gray-800/20 border-white/20 dark:border-gray-700/20 hover:bg-white/30 dark:hover:bg-gray-800/30',
              isActive('dashboard') && 'border-primary/50',
              isDragging && 'cursor-grabbing'
            )}
            style={{ touchAction: 'none' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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
              isActive('dashboard') ? 'bg-gradient-to-br from-primary to-secondary shadow-lg animate-pulse-active' : 'hover:bg-gray-100/50 dark:hover:bg-gray-700/50'
            )}>
              <Icon 
                name={navItems[0].icon} 
                size={18} 
                className={cn(
                  'transition-colors duration-300',
                  isActive('dashboard') ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                )}
              />
            </div>
            <span className={cn(
              'text-[10px] font-medium transition-all duration-300',
              isActive('dashboard') ? 'text-primary font-bold' : 'text-gray-600 dark:text-gray-300'
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