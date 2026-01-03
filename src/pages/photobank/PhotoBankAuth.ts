import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdminUser } from '@/utils/adminCheck';
import { isAdminViewingSessionValid } from '@/utils/sessionCleanup';

export const getAuthUserId = (): string | null => {
  console.log('[PHOTO_BANK] getAuthUserId called');
  
  // Проверяем валидность сессии просмотра админом
  if (!isAdminViewingSessionValid()) {
    console.warn('[PHOTO_BANK] Admin viewing session invalid, cleared');
  }
  
  const adminViewingUserId = localStorage.getItem('admin_viewing_user_id');
  console.log('[PHOTO_BANK] admin_viewing_user_id from localStorage:', adminViewingUserId);
  
  if (adminViewingUserId) {
    const authSession = localStorage.getItem('authSession');
    const vkUser = localStorage.getItem('vk_user');
    const googleUser = localStorage.getItem('google_user');
    
    console.log('[PHOTO_BANK] Auth data check:', {
      hasAuthSession: !!authSession,
      hasVkUser: !!vkUser,
      hasGoogleUser: !!googleUser
    });
    
    let adminEmail = null;
    let adminVkData = null;
    
    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        adminEmail = session.userEmail;
      } catch {}
    }
    
    if (vkUser) {
      try {
        adminVkData = JSON.parse(vkUser);
      } catch {}
    }
    
    const isAdmin = isAdminUser(adminEmail, adminVkData);
    console.log('[PHOTO_BANK] isAdminUser check:', isAdmin, 'adminEmail:', adminEmail);
    
    if (isAdmin) {
      console.log('[PHOTO_BANK] Admin viewing user confirmed, using userId:', adminViewingUserId);
      return adminViewingUserId;
    } else {
      console.warn('[PHOTO_BANK] admin_viewing_user_id exists but user is not admin, clearing');
      localStorage.removeItem('admin_viewing_user_id');
      localStorage.removeItem('admin_viewing_user');
    }
  }
  
  const authSession = localStorage.getItem('authSession');
  if (authSession) {
    try {
      const session = JSON.parse(authSession);
      if (session.userId) return session.userId.toString();
    } catch {}
  }
  
  const vkUser = localStorage.getItem('vk_user');
  if (vkUser) {
    try {
      const userData = JSON.parse(vkUser);
      if (userData.user_id) return userData.user_id.toString();
      if (userData.vk_id) return userData.vk_id.toString();
    } catch {}
  }
  
  const googleUser = localStorage.getItem('google_user');
  if (googleUser) {
    try {
      const userData = JSON.parse(googleUser);
      if (userData.user_id) return userData.user_id.toString();
      if (userData.id) return userData.id.toString();
      if (userData.sub) return userData.sub.toString();
    } catch {}
  }
  
  return null;
};

export const usePhotoBankAuth = () => {
  const navigate = useNavigate();
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const authSession = localStorage.getItem('authSession');
      const vkUser = localStorage.getItem('vk_user');
      const googleUser = localStorage.getItem('google_user');
      const adminViewingUserId = localStorage.getItem('admin_viewing_user_id');
      
      console.log('[PHOTO_BANK] Auth check:', { 
        hasAuthSession: !!authSession, 
        hasVkUser: !!vkUser,
        hasGoogleUser: !!googleUser,
        hasAdminViewingUserId: !!adminViewingUserId
      });
      
      // Если нет авторизации, очищаем admin_viewing_user_id
      if (!authSession && !vkUser && !googleUser) {
        if (adminViewingUserId) {
          console.log('[PHOTO_BANK] No auth found, clearing admin viewing session');
          localStorage.removeItem('admin_viewing_user_id');
          localStorage.removeItem('admin_viewing_user');
        }
        console.log('[PHOTO_BANK] No auth found, redirecting to /');
        navigate('/');
        return;
      }
      
      // Проверка: если есть admin_viewing_user_id, но пользователь не админ - очистить
      if (adminViewingUserId) {
        let adminEmail = null;
        let adminVkData = null;
        
        if (authSession) {
          try {
            const session = JSON.parse(authSession);
            adminEmail = session.userEmail;
          } catch {}
        }
        
        if (vkUser) {
          try {
            adminVkData = JSON.parse(vkUser);
          } catch {}
        }
        
        const isAdmin = isAdminUser(adminEmail, adminVkData);
        
        if (!isAdmin) {
          console.log('[PHOTO_BANK] User is not admin anymore, clearing admin viewing session');
          localStorage.removeItem('admin_viewing_user_id');
          localStorage.removeItem('admin_viewing_user');
        }
      }
      
      if (authSession) {
        try {
          const session = JSON.parse(authSession);
          console.log('[PHOTO_BANK] Auth session:', { 
            isAuthenticated: session.isAuthenticated, 
            userId: session.userId,
            hasUserId: !!session.userId
          });
          if (!session.userId) {
            console.log('[PHOTO_BANK] No userId in session, redirecting to /');
            navigate('/');
            return;
          }
        } catch (err) {
          console.log('[PHOTO_BANK] Error parsing auth session:', err);
          navigate('/');
          return;
        }
      }
      
      console.log('[PHOTO_BANK] Auth check passed');
      setAuthChecking(false);
    };
    
    checkAuth();
    
    // Слушаем изменения в localStorage (для logout в других вкладках)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authSession' || e.key === 'vk_user' || e.key === 'google_user') {
        console.log('[PHOTO_BANK] Auth storage changed, re-checking');
        checkAuth();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate]);

  return { authChecking };
};

export const useEmailVerification = (userId: string | null, authChecking: boolean) => {
  const [emailVerified, setEmailVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(true);

  useEffect(() => {
    if (!userId || authChecking) return;
    
    const checkEmailVerification = async () => {
      try {
        const authSession = localStorage.getItem('authSession');
        const vkUser = localStorage.getItem('vk_user');
        const googleUser = localStorage.getItem('google_user');
        
        let userEmail = null;
        let vkUserData = null;
        
        if (authSession) {
          try {
            const session = JSON.parse(authSession);
            userEmail = session.userEmail;
          } catch {}
        }
        
        if (vkUser) {
          try {
            vkUserData = JSON.parse(vkUser);
          } catch {}
        }
        
        if (isAdminUser(userEmail, vkUserData)) {
          console.log('[PHOTO_BANK] Admin user detected, bypassing verification');
          setEmailVerified(true);
          setCheckingVerification(false);
          return;
        }

        if (googleUser) {
          console.log('[PHOTO_BANK] Google user detected, auto-verified');
          setEmailVerified(true);
          setCheckingVerification(false);
          return;
        }
        
        console.log('[PHOTO_BANK] Checking email verification for userId:', userId);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`Verification API returned ${res.status}`);
        }
        
        const data = await res.json();
        console.log('[PHOTO_BANK] Verification response:', data);
        setEmailVerified(!!data.email_verified_at);
      } catch (err: any) {
        console.error('[PHOTO_BANK] Failed to check email verification:', err);
        setEmailVerified(false);
      } finally {
        setCheckingVerification(false);
      }
    };
    
    checkEmailVerification();
  }, [userId, authChecking]);

  return { emailVerified, checkingVerification };
};

export const getIsAdminViewing = (): boolean => {
  const adminViewingUserId = localStorage.getItem('admin_viewing_user_id');
  if (!adminViewingUserId) return false;
  
  const authSession = localStorage.getItem('authSession');
  const vkUser = localStorage.getItem('vk_user');
  
  let adminEmail = null;
  let adminVkData = null;
  
  if (authSession) {
    try {
      const session = JSON.parse(authSession);
      adminEmail = session.userEmail;
    } catch {}
  }
  
  if (vkUser) {
    try {
      adminVkData = JSON.parse(vkUser);
    } catch {}
  }
  
  return isAdminUser(adminEmail, adminVkData);
};