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
  needs2FA: boolean;
  pendingUserData: any | null;
  isBlocked: boolean;
  blockReason: string | null;
  blockData: any | null;
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
  const [needs2FA, setNeeds2FA] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<any | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [blockData, setBlockData] = useState<any | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const handleLoginSuccess = (uid: number, email?: string) => {
    const isUserAdmin = isAdminUser(email || null, null);
    setIsAuthenticated(true);
    setUserId(uid);
    setUserEmail(email || '');
    setIsAdmin(isUserAdmin);
    setCurrentPage('dashboard');
    lastActivityRef.current = Date.now();
    
    localStorage.setItem('userId', uid.toString());
    
    localStorage.setItem('authSession', JSON.stringify({
      isAuthenticated: true,
      userId: uid,
      userEmail: email || '',
      isAdmin: isUserAdmin,
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
            console.log('🔍 Block check:', { 
              hasError: !!data.error, 
              isBlocked: !!data.blocked,
              message: data.message 
            });
            
            // Check if user is blocked
            if (data.error && data.blocked) {
              console.log('🚫 User IS BLOCKED! Setting state...');
              console.log('🚫 Block details:', {
                message: data.message,
                userId: data.user_id,
                userEmail: data.user_email,
                authMethod: data.auth_method
              });
              
              setIsBlocked(true);
              setBlockReason(data.message);
              setBlockData({
                userId: data.user_id,
                userEmail: data.user_email,
                authMethod: data.auth_method || 'vk'
              });
              setLoading(false);
              window.history.replaceState({}, '', '/');
              
              console.log('🚫 State updated. isBlocked should be TRUE now');
              return;
            }
            
            if (data.userData && data.token) {
              const userData = data.userData;
              const isUserAdmin = isAdminUser(userData.email || null, userData);
              
              console.log('🔍 Checking admin status:', {
                userName: userData.name,
                userEmail: userData.email,
                isUserAdmin,
                requires2FA: data.requires_2fa || userData.requires_2fa
              });
              
              const uid = userData.user_id || userData.vk_id;
              
              // Check if user has 2FA enabled from session data
              const requires2FA = data.requires_2fa || userData.requires_2fa;
              
              if (requires2FA && userData.email) {
                // User has 2FA enabled - show 2FA dialog
                console.log('🔒 2FA required - showing dialog');
                setPendingUserData(userData);
                setNeeds2FA(true);
                setLoading(false);
                window.history.replaceState({}, '', '/');
              } else {
                // No 2FA - proceed with normal login
                localStorage.setItem('vk_user', JSON.stringify(userData));
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('userId', uid.toString());
                
                console.log('✅ VK data saved to localStorage from session:', userData);
                
                setIsAuthenticated(true);
                setUserId(uid);
                setUserEmail(userData.email || '');
                setUserName(userData.name || 'Пользователь VK');
                setUserAvatar(userData.avatar || '');
                setIsVerified(userData.verified || false);
                setIsAdmin(isUserAdmin);
                setCurrentPage('dashboard');
                lastActivityRef.current = Date.now();
                
                window.history.replaceState({}, '', '/');
                
                console.log('✅ VK auth complete, showing dashboard');
              }
            }
          })
          .catch(error => {
            console.error('❌ Error fetching VK session:', error);
            setLoading(false);
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
          const uid = userData.user_id || userData.vk_id;
          
          // CRITICAL: Check if user is still not blocked before restoring session
          console.log('🔍 Checking if user is blocked before restoring session...');
          
          // Check block status via users-management endpoint
          fetch(`https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a?checkUserId=${uid}`)
            .then(res => res.json())
            .then(blockData => {
              console.log('🔍 Block check result:', blockData);
              
              // Check if user is blocked
              if (blockData.blocked === true) {
                console.log('🚫 User IS BLOCKED! Showing dialog...');
                setIsBlocked(true);
                setBlockReason(blockData.message || 'Ваш аккаунт был заблокирован администратором');
                setBlockData({
                  userId: blockData.user_id || uid,
                  userEmail: blockData.user_email || userData.email,
                  authMethod: blockData.auth_method || 'vk'
                });
                handleLogout();
                setLoading(false);
                console.log('🚫 Block dialog should appear now');
                return;
              }
              
              console.log('✅ User not blocked, loading user data...');
              
              // User not blocked, load user data
              fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${uid}`)
                .then(res => res.json())
                .then(data => {
                  continueSessionRestore(userData, data, uid);
                })
                .catch(err => {
                  console.error('❌ Error loading user data:', err);
                  continueSessionRestore(userData, {}, uid);
                });
            })
            .catch(err => {
              console.error('❌ Error checking block status:', err);
              handleLogout();
              setLoading(false);
            });
          
          const continueSessionRestore = (userData: any, dbData: any, uid: number) => {
            const isUserAdmin = isAdminUser(userData.email || dbData.email || null, userData);
            
            console.log('🔍 Checking admin status (localStorage):', {
              userName: userData.name,
              userEmail: userData.email || dbData.email,
              isUserAdmin
            });
            
            console.log('✅ VK user session validated, not blocked');
            
            localStorage.setItem('userId', uid.toString());
            
            setIsAuthenticated(true);
            setUserId(uid);
            setUserName(userData.name || 'Пользователь VK');
            setUserAvatar(userData.avatar || '');
            setIsVerified(userData.is_verified || userData.verified || false);
            setIsAdmin(isUserAdmin);
            setCurrentPage('dashboard');
            lastActivityRef.current = Date.now();
            
            if (dbData.email) {
              setUserEmail(dbData.email);
              const updatedUserData = { ...userData, email: dbData.email };
              localStorage.setItem('vk_user', JSON.stringify(updatedUserData));
              console.log('✅ Email loaded from database:', dbData.email);
            } else {
              setUserEmail(userData.email || '');
            }
            
            if (vkAuthCompleted) {
              localStorage.removeItem('vk_auth_completed');
            }
            
            console.log('✅ VK session restored, redirecting to dashboard');
          };
          
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
    
    // Фикс для пользователей у которых нет userId в localStorage но есть vk_user
    const fixMissingUserId = () => {
      const storedUserId = localStorage.getItem('userId');
      if (!storedUserId) {
        const vkUser = localStorage.getItem('vk_user');
        if (vkUser) {
          try {
            const userData = JSON.parse(vkUser);
            const uid = userData.user_id || userData.vk_id;
            if (uid) {
              localStorage.setItem('userId', uid.toString());
              console.log('[FIX] Restored missing userId from vk_user:', uid);
            }
          } catch (e) {
            console.error('[FIX] Failed to restore userId:', e);
          }
        }
      }
    };
    
    fixMissingUserId();
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
    needs2FA,
    pendingUserData,
    isBlocked,
    blockReason,
    blockData,
    setNeeds2FA,
    setPendingUserData,
    setIsBlocked,
    lastActivityRef,
    handleLoginSuccess,
    handleLogout,
  };
};