import { useState, useEffect, useRef } from 'react';
import { isAdminUser } from '@/utils/adminCheck';
import { clearUserSession } from '@/utils/sessionCleanup';

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
  needsTelegramVerification: boolean;
}

const getSessionTimeout = async (): Promise<number> => {
  try {
    const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=session_timeout_minutes');
    const data = await response.json();
    return (data.value || 7) * 60 * 1000;
  } catch (error) {
    console.warn('[AUTH] Failed to load session timeout, using default 7 minutes');
    return 7 * 60 * 1000;
  }
};

let SESSION_TIMEOUT = 7 * 60 * 1000;

getSessionTimeout().then(timeout => {
  SESSION_TIMEOUT = timeout;
  console.log('[AUTH] Session timeout loaded:', SESSION_TIMEOUT / 60000, 'minutes');
});

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
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('Доступ на вход временно недоступен по техническим причинам');
  const [needsTelegramVerification, setNeedsTelegramVerification] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  const handleLoginSuccess = async (uid: number, email?: string, token?: string) => {
    const isUserAdmin = isAdminUser(email || null, null);
    
    // Проверяем настройку блокировки входа для не-админов
    if (!isUserAdmin) {
      try {
        const [blockResponse, messageResponse] = await Promise.all([
          fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=block_non_admin_login'),
          fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=block_login_message')
        ]);
        
        const blockData = await blockResponse.json();
        const messageData = await messageResponse.json();
        
        if (blockData.value === true) {
          console.log('🚫 Non-admin login blocked by admin setting');
          setAccessDeniedMessage(messageData.value || 'Доступ на вход временно недоступен по техническим причинам');
          setShowAccessDenied(true);
          return;
        }
      } catch (error) {
        console.error('Error checking block_non_admin_login setting:', error);
      }
    }
    
    // Проверяем верификацию Telegram (для не-админов)
    if (!isUserAdmin) {
      try {
        const verifyResponse = await fetch(`https://functions.poehali.dev/46d9b487-dbc7-4472-a333-3b30ed8d2733?action=check&user_id=${uid}`);
        const verifyData = await verifyResponse.json();
        
        if (!verifyData.verified) {
          console.log('[AUTH] User needs Telegram verification');
          setNeedsTelegramVerification(true);
          setUserId(uid);
          setUserEmail(email || '');
          setIsAdmin(false);
          setIsAuthenticated(true);
          setCurrentPage('dashboard');
          lastActivityRef.current = Date.now();
          
          localStorage.setItem('userId', uid.toString());
          if (token) {
            localStorage.setItem('auth_token', token);
          }
          
          localStorage.setItem('authSession', JSON.stringify({
            isAuthenticated: true,
            userId: uid,
            userEmail: email || '',
            isAdmin: false,
            currentPage: 'dashboard',
            lastActivity: Date.now(),
          }));
          return;
        }
      } catch (error) {
        console.error('Error checking Telegram verification:', error);
      }
    }
    
    setIsAuthenticated(true);
    setUserId(uid);
    setUserEmail(email || '');
    setIsAdmin(isUserAdmin);
    setCurrentPage('dashboard');
    setNeedsTelegramVerification(false);
    lastActivityRef.current = Date.now();
    
    localStorage.setItem('userId', uid.toString());
    
    if (token) {
      localStorage.setItem('auth_token', token);
      console.log('[AUTH] Token saved to localStorage');
    }
    
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
    localStorage.removeItem('google_user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('vk_user_id');
    localStorage.removeItem('vk_access_token');
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    const restoreSession = () => {
      console.log('🔄 Restoring session...');
      console.log('🔍 Full URL:', window.location.href);
      console.log('🔍 Query params:', Object.fromEntries(urlParams.entries()));
      
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
          .then(res => {
            console.log('📦 Session response status:', res.status);
            
            // Check if user is blocked (403 status)
            if (res.status === 403) {
              return res.json().then(data => {
                console.log('🚫 User IS BLOCKED! Status 403 detected');
                throw { blocked: true, data };
              });
            }
            
            // Если эндпоинт падает (500) - логируем и продолжаем
            if (res.status === 500) {
              console.warn('[VK_AUTH] VK auth endpoint returned 500, cannot restore session');
              throw { serverError: true };
            }
            
            return res.json();
          })
          .then(data => {
            console.log('📦 Session data received:', data);
            console.log('🔍 Block check:', { 
              hasError: !!data.error, 
              isBlocked: !!data.blocked,
              message: data.message 
            });
            
            // Double check if user is blocked (in case status wasn't 403)
            if (data.blocked === true) {
              console.log('🚫 User IS BLOCKED! Setting state...');
              console.log('🚫 Block details:', {
                message: data.message,
                userId: data.user_id,
                userEmail: data.user_email,
                authMethod: data.auth_method
              });
              
              setIsBlocked(true);
              setBlockReason(data.message || 'Ваш аккаунт был заблокирован администратором');
              setBlockData({
                userId: data.user_id,
                userEmail: data.user_email,
                authMethod: data.auth_method || 'vk'
              });
              setIsAuthenticated(false);
              setUserId(null);
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
            
            // Check if error is because user is blocked
            if (error.blocked && error.data) {
              console.log('🚫 Handling blocked user from catch:', error.data);
              setIsBlocked(true);
              setBlockReason(error.data.message || 'Ваш аккаунт был заблокирован администратором');
              setBlockData({
                userId: error.data.user_id,
                userEmail: error.data.user_email,
                authMethod: error.data.auth_method || 'vk'
              });
              setIsAuthenticated(false);
              setUserId(null);
              setLoading(false);
              window.history.replaceState({}, '', '/');
              return;
            }
            
            // Если 500 ошибка - просто не восстанавливаем сессию (не критично)
            if (error.serverError) {
              console.warn('[VK_AUTH] Cannot restore VK session due to server error');
            }
            
            setLoading(false);
          });
        
        return;
      }
      
      const vkUser = localStorage.getItem('vk_user');
      const googleUser = localStorage.getItem('google_user');
      const vkAuthCompleted = localStorage.getItem('vk_auth_completed');
      
      console.log('📦 LocalStorage check:', { 
        hasVkUser: !!vkUser,
        hasGoogleUser: !!googleUser,
        vkAuthCompleted,
        vkSessionId: !!vkSessionId,
        vkUserData: vkUser ? JSON.parse(vkUser) : null,
        googleUserData: googleUser ? JSON.parse(googleUser) : null
      });
      
      if (vkUser || googleUser) {
        try {
          const userData = JSON.parse(vkUser || googleUser!);
          const authMethod = vkUser ? 'vk' : 'google';
          const uid = userData.user_id;
          
          // CRITICAL: Check session expiry before restoring
          const savedSession = localStorage.getItem('authSession');
          if (savedSession) {
            const session = JSON.parse(savedSession);
            const timeSinceLastActivity = Date.now() - (session.lastActivity || 0);
            
            if (timeSinceLastActivity > SESSION_TIMEOUT) {
              console.log('⏰ Session expired. Logging out...');
              handleLogout();
              setLoading(false);
              alert('Сессия истекла. Пожалуйста, войдите снова.');
              return;
            }
          }
          
          // CRITICAL: Check if user is still not blocked before restoring session
          console.log('🔍 Checking if user is blocked before restoring session...');
          
          // Выполняем проверку блокировки и загрузку данных параллельно для ускорения
          Promise.all([
            fetch(`https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a?checkUserId=${uid}`).then(res => res.json()),
            fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${uid}`).then(res => res.json())
          ])
            .then(([blockData, userData2]) => {
              console.log('🔍 Block check result:', blockData);
              
              // Check if user is blocked
              if (blockData.blocked === true) {
                console.log('🚫 User IS BLOCKED! Showing dialog...');
                
                // Clear session data without resetting block state
                clearUserSession();
                
                setIsBlocked(true);
                setBlockReason(blockData.message || 'Ваш аккаунт был заблокирован администратором');
                setBlockData({
                  userId: blockData.user_id || uid,
                  userEmail: blockData.user_email || userData.email,
                  authMethod: blockData.auth_method || authMethod
                });
                setIsAuthenticated(false);
                setUserId(null);
                setLoading(false);
                console.log('🚫 Block state set. Dialog should render now');
                return;
              }
              
              console.log('✅ User not blocked, continuing...');
              continueSessionRestore(userData, userData2, uid);
            })
            .catch(err => {
              console.error('❌ Error checking session:', err);
              // Не разлогиниваем при ошибке - работаем с кешированными данными
              continueSessionRestore(userData, {}, uid);
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
            setUserName(userData.name || (authMethod === 'vk' ? 'Пользователь VK' : 'Пользователь Google'));
            setUserAvatar(userData.avatar || userData.picture || '');
            setIsVerified(userData.is_verified || userData.verified || userData.verified_email || false);
            setIsAdmin(isUserAdmin);
            setCurrentPage('dashboard');
            lastActivityRef.current = Date.now();
            
            if (dbData.email) {
              setUserEmail(dbData.email);
              const updatedUserData = { ...userData, email: dbData.email };
              if (authMethod === 'vk') {
                localStorage.setItem('vk_user', JSON.stringify(updatedUserData));
              } else {
                localStorage.setItem('google_user', JSON.stringify(updatedUserData));
              }
              console.log('✅ Email loaded from database:', dbData.email);
            } else {
              setUserEmail(userData.email || '');
            }
            
            if (vkAuthCompleted) {
              localStorage.removeItem('vk_auth_completed');
            }
            
            console.log(`✅ ${authMethod.toUpperCase()} session restored, redirecting to dashboard`);
          };
          
          return;
        } catch (error) {
          console.error('❌ Error restoring OAuth session:', error);
          clearUserSession();
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
            console.log('[AUTH] Session timeout, clearing');
            clearUserSession();
          }
        } catch (error) {
          console.error('Ошибка восстановления сессии:', error);
          clearUserSession();
        }
      }
    };

    const checkSettings = async () => {
      // OPTIMIZATION: Check cache first (30 min TTL)
      const CACHE_KEY = 'settings_cache';
      const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
      
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          if (age < CACHE_TTL) {
            console.log('⚡ Using cached settings, age:', Math.round(age / 1000), 'sec');
            setMaintenanceMode(data.maintenance_mode || false);
            setGuestAccess(data.guest_access || false);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error('Cache read error:', e);
      }
      
      // Cache miss or expired - fetch from server
      try {
        const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0');
        const settings = await response.json();
        
        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: settings,
          timestamp: Date.now()
        }));
        
        setMaintenanceMode(settings.maintenance_mode || false);
        setGuestAccess(settings.guest_access || false);
      } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        setMaintenanceMode(false);
        setGuestAccess(true);
      } finally {
        setLoading(false);
      }
    };
    
    restoreSession();
    
    // OPTIMIZATION: Only check settings if user has session or OAuth callback
    const hasSession = localStorage.getItem('authSession') || 
                      localStorage.getItem('vk_user') ||
                      localStorage.getItem('google_user') ||
                      urlParams.get('vk_session');
    
    if (hasSession) {
      checkSettings();
    } else {
      // No session = guest mode, skip settings check
      setMaintenanceMode(false);
      setGuestAccess(true);
      setLoading(false);
    }
    
    // Фикс для пользователей у которых нет userId в localStorage но есть vk_user или google_user
    const fixMissingUserId = () => {
      const storedUserId = localStorage.getItem('userId');
      if (!storedUserId) {
        const vkUser = localStorage.getItem('vk_user');
        const googleUser = localStorage.getItem('google_user');
        const oauthUser = vkUser || googleUser;
        if (oauthUser) {
          try {
            const userData = JSON.parse(oauthUser);
            const uid = userData.user_id || userData.vk_id;
            if (uid) {
              localStorage.setItem('userId', uid.toString());
              console.log('[FIX] Restored missing userId from OAuth user:', uid);
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
    showAccessDenied,
    accessDeniedMessage,
    needsTelegramVerification,
    setNeedsTelegramVerification,
    setShowAccessDenied,
    setNeeds2FA,
    setPendingUserData,
    setIsBlocked,
    lastActivityRef,
    handleLoginSuccess,
    handleLogout,
  };
};