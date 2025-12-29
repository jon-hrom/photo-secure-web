import { useState, useEffect } from 'react';
import { isAdminUser } from '@/utils/adminCheck';

interface UseVerificationChecksProps {
  isAuthenticated: boolean;
  userId: string | number | null;
  currentPage: string;
  isAdmin: boolean;
}

export const useVerificationChecks = ({ 
  isAuthenticated, 
  userId, 
  currentPage,
  isAdmin 
}: UseVerificationChecksProps) => {
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [userSource, setUserSource] = useState<'email' | 'vk' | 'google' | 'yandex'>('email');
  const [hasEmail, setHasEmail] = useState(true);
  const [hasVerifiedPhone, setHasVerifiedPhone] = useState(false);

  useEffect(() => {
    const checkPhoneVerification = async () => {
      if (!isAuthenticated || !userId) {
        setHasVerifiedPhone(false);
        return;
      }
      
      try {
        const res = await fetch(`https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setHasVerifiedPhone(!!(data.phone && data.phone.trim() && data.phone_verified_at));
        }
      } catch (err) {
        console.error('Failed to check phone verification:', err);
      }
    };
    
    checkPhoneVerification();
  }, [isAuthenticated, userId]);

  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!isAuthenticated || !userId) {
        setEmailVerified(false);
        setShowEmailVerification(false);
        return;
      }
      
      if (currentPage !== 'dashboard') {
        return;
      }
      
      const userIdFromStorage = localStorage.getItem('userId');
      if (!userIdFromStorage) {
        return;
      }
      
      const authSession = localStorage.getItem('authSession');
      const vkUser = localStorage.getItem('vk_user');
      
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
        setEmailVerified(true);
        setShowEmailVerification(false);
        return;
      }
      
      const dismissedKey = `email_verification_dismissed_${userId}`;
      const dismissed = localStorage.getItem(dismissedKey);
      
      try {
        const res = await fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`);
        
        if (!res.ok) {
          return;
        }
        
        const data = await res.json();
        
        setUserSource(data.source || 'email');
        setHasEmail(!!(data.email && data.email.trim()));
        
        if (data.email_verified_at) {
          setEmailVerified(true);
          setShowEmailVerification(false);
          localStorage.removeItem(dismissedKey);
        } else if (!dismissed && data.email && data.email.trim()) {
          setShowEmailVerification(true);
        } else {
          setShowEmailVerification(false);
        }
      } catch (err) {
        console.error('Failed to check email verification:', err);
      }
    };
    
    checkEmailVerification();
  }, [isAuthenticated, userId, currentPage]);

  return {
    showEmailVerification,
    setShowEmailVerification,
    emailVerified,
    setEmailVerified,
    userSource,
    hasEmail,
    hasVerifiedPhone
  };
};