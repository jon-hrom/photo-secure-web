import { useState, useEffect, useRef } from 'react';
import { isAdminUser } from '@/utils/adminCheck';

export interface AuthState {
  isAuthenticated: boolean;
  userId: number | null;
  userEmail: string;
  userName: string;
  userAvatar: string;
  isVerified: boolean;
  isAdmin: boolean;
  currentPage: 'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin';
}

const SESSION_TIMEOUT = 7 * 60 * 1000;

export const useAuth = () => {
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
  const lastActivityRef = useRef<number>(Date.now());

  const handleLoginSuccess = (uid: number, email?: string) => {
    const isUserAdmin = isAdminUser(email || null, null);
    const page = isUserAdmin ? 'admin' : 'dashboard';
    setIsAuthenticated(true);
    setUserId(uid);
    setUserEmail(email || '');
    setIsAdmin(isUserAdmin);
    setCurrentPage(page);
    lastActivityRef.current = Date.now();
    
    localStorage.setItem('userId', uid.toString());
    
    localStorage.setItem('authSession', JSON.stringify({
      isAuthenticated: true,
      userId: uid,
      userEmail: email || '',
      isAdmin: isUserAdmin,
      currentPage: page,
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
    localStorage.removeItem('vk_user_id');
    localStorage.removeItem('vk_access_token');
  };

  useEffect(() => {
    const restoreSession = () => {
      console.log('🔄 Restoring session...');
      
      const urlParams = new URLSearchParams(window.location.search);
      const forceLogout = urlParams.get('logout');
      
      if (forceLogout === 'true') {
        console.log('🚪 Force logout triggered');
        handleLogout();
        window.history.replaceState({}, '', window.location.pathname);
        setLoading(false);
        return;
      }
      
      const vkSessionId = urlParams.get('vk_session');
      
      if (vkSessionId) {
        console.log('📦 VK session ID in URL detected:', vkSessionId);
        
        fetch(`https://functions.poehali.dev/d90ae010-c236-4173-bf65-6a3aef34156c?session_id=${vkSessionId}`)
          .then(res => res.json())
          .then(data => {
            console.log('📦 Session data received:', data);
            
            if (data.userData && data.token) {
              const userData = data.userData;
              const isUserAdmin = isAdminUser(userData.email || null, userData);
              
              console.log('🔍 Checking admin status:', {
                userName: userData.name,
                userEmail: userData.email,
                isUserAdmin
              });
              
              localStorage.setItem('vk_user', JSON.stringify(userData));
              localStorage.setItem('auth_token', data.token);
              
              console.log('✅ VK data saved to localStorage from session:', userData);
              
              setIsAuthenticated(true);
              setUserId(userData.user_id || userData.vk_id);
              setUserEmail(userData.email || '');
              setUserName(userData.name || 'Пользователь VK');
              setUserAvatar(userData.avatar || '');
              setIsVerified(userData.verified || false);
              setIsAdmin(isUserAdmin);
              setCurrentPage(isUserAdmin ? 'admin' : 'dashboard');
              lastActivityRef.current = Date.now();
              
              window.history.replaceState({}, '', '/');
              
              console.log('✅ VK auth complete, showing dashboard');
            }
          })
          .catch(error => {
            console.error('❌ Error fetching VK session:', error);
          });
        
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
          const isUserAdmin = isAdminUser(userData.email || null, userData);
          
          console.log('🔍 Checking admin status (localStorage):', {
            userName: userData.name,
            userEmail: userData.email,
            isUserAdmin
          });
          
          console.log('✅ VK user found in localStorage:', userData);
          
          setIsAuthenticated(true);
          setUserId(userData.user_id || userData.vk_id);
          setUserName(userData.name || 'Пользователь VK');
          setUserAvatar(userData.avatar || '');
          setIsVerified(userData.is_verified || userData.verified || false);
          setIsAdmin(isUserAdmin);
          setCurrentPage(isUserAdmin ? 'admin' : 'dashboard');
          lastActivityRef.current = Date.now();
          
          const userId = userData.user_id || userData.vk_id;
          if (userId) {
            fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`)
              .then(res => res.json())
              .then(data => {
                if (data.email) {
                  setUserEmail(data.email);
                  const updatedUserData = { ...userData, email: data.email };
                  localStorage.setItem('vk_user', JSON.stringify(updatedUserData));
                  console.log('✅ Email loaded from database:', data.email);
                } else {
                  setUserEmail('');
                }
              })
              .catch(err => {
                console.error('❌ Error loading user data:', err);
                setUserEmail(userData.email || '');
              });
          } else {
            setUserEmail(userData.email || '');
          }
          
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

  return {
    currentPage,
    setCurrentPage,
    isAuthenticated,
    userId,
    userEmail,
    userName,
    userAvatar,
    isVerified,
    isAdmin,
    maintenanceMode,
    guestAccess,
    loading,
    lastActivityRef,
    handleLoginSuccess,
    handleLogout,
  };
};