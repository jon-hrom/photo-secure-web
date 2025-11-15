import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import Dashboard from '@/components/Dashboard';
import ClientsPage from '@/components/ClientsPage';
import PhotobookPage from '@/components/PhotobookPage';
import LoginPage from '@/components/LoginPage';
import SettingsPage from '@/components/SettingsPage';
import FeaturesPage from '@/components/FeaturesPage';
import AdminPanel from '@/components/AdminPanel';
import MaintenancePage from '@/components/MaintenancePage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Index = () => {
  const [currentPage, setCurrentPage] = useState<'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin'>('auth');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [isVerified, setIsVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [guestAccess, setGuestAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedClientName, setSelectedClientName] = useState<string | undefined>(undefined);
  const lastActivityRef = useRef<number>(Date.now());
  const SESSION_TIMEOUT = 7 * 60 * 1000;

  const handleLoginSuccess = (uid: number, email?: string) => {
    const isAdminUser = email === 'jonhrom2012@gmail.com';
    setIsAuthenticated(true);
    setUserId(uid);
    setUserEmail(email || '');
    setIsAdmin(isAdminUser);
    setCurrentPage(isAdminUser ? 'admin' : 'dashboard');
    lastActivityRef.current = Date.now();
    
    localStorage.setItem('authSession', JSON.stringify({
      isAuthenticated: true,
      userId: uid,
      userEmail: email || '',
      isAdmin: isAdminUser,
      currentPage: 'dashboard',
      lastActivity: Date.now(),
    }));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserId(null);
    setUserEmail('');
    setUserName('');
    setUserAvatar('');
    setIsVerified(false);
    setIsAdmin(false);
    setCurrentPage('auth');
    localStorage.removeItem('authSession');
    localStorage.removeItem('vk_user');
    localStorage.removeItem('auth_token');
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      
      const savedSession = localStorage.getItem('authSession');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          localStorage.setItem('authSession', JSON.stringify({
            ...session,
            lastActivity: now,
          }));
        } catch (error) {
          console.error('Ошибка обновления активности:', error);
        }
      }
    };

    const checkSession = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      if (timeSinceLastActivity > SESSION_TIMEOUT) {
        handleLogout();
        alert('Сессия истекла. Пожалуйста, войдите снова.');
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, updateActivity));

    const interval = setInterval(checkSession, 30000);

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const restoreSession = () => {
      console.log('🔄 Restoring session...');
      
      const urlParams = new URLSearchParams(window.location.search);
      const vkSessionId = urlParams.get('vk_session');
      
      // Check if VK session ID in URL
      if (vkSessionId) {
        console.log('📦 VK session ID in URL detected:', vkSessionId);
        
        // Fetch session data from backend
        fetch(`https://functions.poehali.dev/d90ae010-c236-4173-bf65-6a3aef34156c?session_id=${vkSessionId}`)
          .then(res => res.json())
          .then(data => {
            console.log('📦 Session data received:', data);
            
            if (data.userData && data.token) {
              const userData = data.userData;
              const isAdminUser = userData.email === 'jonhrom2012@gmail.com' || 
                                  (userData.name && userData.name.includes('Пономарев Евгений'));
              
              console.log('🔍 Checking admin status:', {
                userName: userData.name,
                userEmail: userData.email,
                isAdminUser,
                nameIncludes: userData.name && userData.name.includes('Пономарев Евгений')
              });
              
              // Save to localStorage
              localStorage.setItem('vk_user', JSON.stringify(userData));
              localStorage.setItem('auth_token', data.token);
              
              console.log('✅ VK data saved to localStorage from session:', userData);
              
              // Set state immediately - no reload needed
              setIsAuthenticated(true);
              setUserId(userData.user_id || userData.vk_id);
              setUserEmail(userData.email || '');
              setUserName(userData.name || 'Пользователь VK');
              setUserAvatar(userData.avatar || '');
              setIsVerified(userData.verified || false);
              setIsAdmin(isAdminUser);
              setCurrentPage('dashboard');
              lastActivityRef.current = Date.now();
              
              // Clean URL
              window.history.replaceState({}, '', '/');
              
              console.log('✅ VK auth complete, showing dashboard');
            }
          })
          .catch(error => {
            console.error('❌ Error fetching VK session:', error);
          });
        
        // Return early to prevent checking localStorage during VK auth
        return;
      }
      
      const vkUser = localStorage.getItem('vk_user');
      const vkAuthCompleted = localStorage.getItem('vk_auth_completed');
      
      console.log('📦 LocalStorage check:', { 
        hasVkUser: !!vkUser, 
        vkAuthCompleted,
        vkSessionId: !!vkSessionId,
        vkUserData: vkUser ? JSON.parse(vkUser) : null 
      });
      
      if (vkUser) {
        try {
          const userData = JSON.parse(vkUser);
          const isAdminUser = userData.email === 'jonhrom2012@gmail.com' || 
                              (userData.name && userData.name.includes('Пономарев Евгений'));
          
          console.log('🔍 Checking admin status (localStorage):', {
            userName: userData.name,
            userEmail: userData.email,
            isAdminUser,
            nameIncludes: userData.name && userData.name.includes('Пономарев Евгений')
          });
          
          console.log('✅ VK user found in localStorage:', userData);
          
          setIsAuthenticated(true);
          setUserId(userData.user_id || userData.vk_id);
          setUserEmail(userData.email || '');
          setUserName(userData.name || 'Пользователь VK');
          setUserAvatar(userData.avatar || '');
          setIsVerified(userData.is_verified || userData.verified || false);
          setIsAdmin(isAdminUser);
          setCurrentPage('dashboard');
          lastActivityRef.current = Date.now();
          
          if (vkAuthCompleted) {
            localStorage.removeItem('vk_auth_completed');
          }
          
          console.log('✅ VK session restored, redirecting to dashboard');
          return;
        } catch (error) {
          console.error('❌ Error restoring VK session:', error);
          localStorage.removeItem('vk_user');
          localStorage.removeItem('vk_auth_completed');
        }
      }
      
      const savedSession = localStorage.getItem('authSession');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          const now = Date.now();
          const timeSinceLastActivity = now - (session.lastActivity || 0);
          
          if (timeSinceLastActivity < SESSION_TIMEOUT) {
            setIsAuthenticated(session.isAuthenticated);
            setUserId(session.userId);
            setUserEmail(session.userEmail);
            setIsAdmin(session.isAdmin);
            setCurrentPage(session.currentPage || 'dashboard');
            lastActivityRef.current = now;
          } else {
            localStorage.removeItem('authSession');
          }
        } catch (error) {
          console.error('Ошибка восстановления сессии:', error);
          localStorage.removeItem('authSession');
        }
      }
    };

    const checkSettings = async () => {
      try {
        const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0');
        const settings = await response.json();
        setMaintenanceMode(settings.maintenance_mode || false);
        setGuestAccess(settings.guest_access || false);
      } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
      } finally {
        setLoading(false);
      }
    };
    
    restoreSession();
    checkSettings();
  }, []);

  useEffect(() => {
    if (currentPage !== 'clients') {
      setSelectedClientName(undefined);
    }
    
    if (isAuthenticated) {
      const savedSession = localStorage.getItem('authSession');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          localStorage.setItem('authSession', JSON.stringify({
            ...session,
            currentPage,
            lastActivity: Date.now(),
          }));
        } catch (error) {
          console.error('Ошибка обновления сессии:', error);
        }
      }
    }
  }, [currentPage, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (maintenanceMode && !isAdmin) {
    return <MaintenancePage />;
  }

  if (!isAuthenticated && !guestAccess) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (!isAuthenticated && guestAccess && currentPage === 'auth') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (!isAuthenticated && guestAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-purple-50/30 to-blue-50/30">
        <nav className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Icon name="Camera" className="text-primary" size={32} />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Foto-Mix
                </h1>
              </div>
              <Button
                variant="default"
                onClick={() => setCurrentPage('auth')}
                className="rounded-full"
              >
                <Icon name="LogIn" size={18} className="mr-2" />
                Войти
              </Button>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-4 py-8">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Icon name="Info" className="text-blue-500" size={24} />
            <p className="text-blue-700">
              Вы просматриваете сайт как гость. <button onClick={() => setCurrentPage('auth')} className="underline font-semibold">Войдите</button>, чтобы получить полный доступ.
            </p>
          </div>
          <Dashboard 
            userRole="guest" 
            onOpenClientBooking={(clientName) => {
              setCurrentPage('auth');
            }}
            onLogout={handleLogout}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-50/30 to-blue-50/30">
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
                  <DropdownMenuItem onClick={() => setCurrentPage('dashboard')}>
                    <Icon name="LayoutDashboard" size={18} className="mr-2" />
                    Главная
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentPage('clients')}>
                    <Icon name="Users" size={18} className="mr-2" />
                    Клиенты
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentPage('photobook')}>
                    <Icon name="Book" size={18} className="mr-2" />
                    Фотокниги
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentPage('features')}>
                    <Icon name="Sparkles" size={18} className="mr-2" />
                    Возможности сервиса
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                onClick={() => setCurrentPage('settings')}
                className="rounded-full border-2 border-primary"
              >
                <Icon name="Settings" size={18} className="mr-2" />
                Настройки
              </Button>
              {isAdmin && (
                <Button
                  variant="default"
                  onClick={() => setCurrentPage('admin')}
                  className="rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                >
                  <Icon name="ShieldCheck" size={18} className="mr-2" />
                  Админ-панель
                </Button>
              )}
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
                  <DropdownMenuItem onClick={handleLogout}>
                    <Icon name="LogOut" size={18} className="mr-2" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {currentPage === 'dashboard' && (
          <Dashboard 
            userRole="user" 
            onOpenClientBooking={(clientName) => {
              setSelectedClientName(clientName);
              setCurrentPage('clients');
            }}
            onLogout={handleLogout}
            onOpenAdminPanel={() => setCurrentPage('admin')}
            isAdmin={isAdmin}
          />
        )}
        {currentPage === 'clients' && <ClientsPage autoOpenClient={selectedClientName} />}
        {currentPage === 'photobook' && <PhotobookPage />}
        {currentPage === 'features' && <FeaturesPage />}
        {currentPage === 'settings' && userId && <SettingsPage userId={userId} />}
        {currentPage === 'admin' && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
};

export default Index;