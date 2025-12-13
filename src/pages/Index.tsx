import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import Dashboard from '@/components/Dashboard';
import ClientsPage from '@/components/ClientsPage';
import PhotobookPage from '@/components/PhotobookPage';
import LoginPage from '@/components/LoginPage';
import SettingsPage from '@/components/SettingsPage';
import FeaturesPage from '@/components/FeaturesPage';
import TariffsPage from '@/components/TariffsPage';
import HelpPage from '@/components/HelpPage';
import AdminPanel from '@/components/AdminPanel';
import MaintenancePage from '@/components/MaintenancePage';
import AppNavigation from '@/components/layout/AppNavigation';
import MobileNavigation from '@/components/layout/MobileNavigation';
import EmailVerificationDialog from '@/components/EmailVerificationDialog';
import TwoFactorDialog from '@/components/TwoFactorDialog';
import OnboardingTour from '@/components/OnboardingTour';
import FloatingAppealsButton from '@/components/FloatingAppealsButton';
import WhatsAppMessenger from '@/components/WhatsAppMessenger';
import BlockedUserDialog from '@/components/BlockedUserDialog';
import BookingDetailsDialog from '@/components/BookingDetailsDialog';
import { useAuth } from '@/hooks/useAuth';
import { useActivityTracking } from '@/hooks/useActivityTracking';
import { isAdminUser } from '@/utils/adminCheck';
import { settingsSync } from '@/utils/settingsSync';
import { toast } from 'sonner';

const Index = () => {
  const [selectedClientName, setSelectedClientName] = useState<string | undefined>(undefined);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [userSource, setUserSource] = useState<'email' | 'vk' | 'google' | 'yandex'>('email');
  const [hasEmail, setHasEmail] = useState(true);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [hasVerifiedPhone, setHasVerifiedPhone] = useState(false);
  
  const {
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
    setIsBlocked,
    lastActivityRef,
    handleLoginSuccess,
    handleLogout,
  } = useAuth();

  useActivityTracking({
    isAuthenticated,
    userEmail,
    lastActivityRef,
    onLogout: handleLogout
  });

  useEffect(() => {
    // Listen for settings updates from admin
    settingsSync.onUpdate(() => {
      toast.info('Доступны обновления настроек', {
        description: 'Перезагрузите страницу, чтобы применить изменения',
        action: {
          label: 'Обновить',
          onClick: () => window.location.reload()
        },
        duration: 30000, // Show for 30 seconds
      });
    });

    return () => {
      settingsSync.destroy();
    };
  }, []);

  useEffect(() => {
    console.log('🔍 [Index] Block state:', { isBlocked, blockReason, blockData });
  }, [isBlocked, blockReason, blockData]);

  useEffect(() => {
    console.log('🔍 [Index] Admin state:', { isAdmin, userId, isAuthenticated });
  }, [isAdmin, userId, isAuthenticated]);

  useEffect(() => {
    if (currentPage !== 'clients' && selectedClientName !== undefined) {
      setSelectedClientName(undefined);
    }
  }, [currentPage, selectedClientName]);

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
          // Считаем телефон подтверждённым если поле phone не пустое
          setHasVerifiedPhone(!!(data.phone && data.phone.trim()));
        }
      } catch (err) {
        console.error('Failed to check phone verification:', err);
      }
    };
    
    checkPhoneVerification();
  }, [isAuthenticated, userId]);

  useEffect(() => {
    const checkEmailVerification = async () => {
      // OPTIMIZATION: Skip check completely if not authenticated
      if (!isAuthenticated || !userId) {
        console.log('[EMAIL_CHECK] Skipping - not authenticated or no userId:', { isAuthenticated, userId });
        setEmailVerified(false);
        setShowEmailVerification(false);
        return;
      }
      
      // OPTIMIZATION: Only check on dashboard page to avoid unnecessary requests
      if (currentPage !== 'dashboard') {
        console.log('[EMAIL_CHECK] Skipping - not on dashboard page');
        return;
      }
      
      const userIdFromStorage = localStorage.getItem('userId');
      if (!userIdFromStorage) {
        console.log('[EMAIL_CHECK] No userId in localStorage, waiting...');
        return;
      }
      
      // Check if user is main admin - skip email verification completely
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
        console.log('[EMAIL_CHECK] Main admin detected - skipping verification');
        setEmailVerified(true);
        setShowEmailVerification(false);
        return;
      }
      
      const dismissedKey = `email_verification_dismissed_${userId}`;
      const dismissed = localStorage.getItem(dismissedKey);
      
      try {
        console.log('[EMAIL_CHECK] Fetching user data for userId:', userId);
        const res = await fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`);
        
        if (!res.ok) {
          console.error('[EMAIL_CHECK] API returned error:', res.status);
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

  // Check for blocked user FIRST before showing login
  if (isBlocked && blockData) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        <BlockedUserDialog
          open={isBlocked}
          onOpenChange={(open) => {
            if (!open) {
              setIsBlocked(false);
            }
          }}
          blockReason={blockReason || undefined}
          userEmail={blockData.userEmail}
          userId={blockData.userId}
          authMethod={blockData.authMethod}
        />
      </>
    );
  }

  if (!isAuthenticated && !guestAccess) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        {needs2FA && pendingUserData && (
          <TwoFactorDialog
            open={needs2FA}
            userId={pendingUserData.user_id || pendingUserData.vk_id}
            userEmail={pendingUserData.email || ''}
            type="email"
            onSuccess={() => {
              setNeeds2FA(false);
              handleLoginSuccess(
                pendingUserData.user_id || pendingUserData.vk_id,
                pendingUserData.email
              );
            }}
            onCancel={() => {
              setNeeds2FA(false);
              handleLogout();
            }}
          />
        )}
      </>
    );
  }

  if (!isAuthenticated && guestAccess && currentPage === 'auth') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (isAuthenticated && !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка данных пользователя...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && guestAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-purple-50/30 to-blue-50/30">
        <nav className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-3 md:px-4 py-3 md:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Icon name="Camera" className="text-primary" size={24} />
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Foto-Mix
                </h1>
              </div>
              <Button
                variant="default"
                onClick={() => setCurrentPage('auth')}
                className="rounded-full text-sm"
                size="sm"
              >
                <Icon name="LogIn" size={16} className="mr-1 md:mr-2" />
                Войти
              </Button>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4 mb-4 md:mb-6 flex items-start md:items-center gap-2 md:gap-3">
            <Icon name="Info" className="text-blue-500 flex-shrink-0" size={20} />
            <p className="text-blue-700 text-sm md:text-base">
              Вы просматриваете сайт как гость. <button onClick={() => setCurrentPage('auth')} className="underline font-semibold">Войдите</button>, чтобы получить полный доступ.
            </p>
          </div>
          <Dashboard 
            userRole="guest" 
            onOpenClientBooking={(clientName) => {
              setCurrentPage('auth');
            }}
            onLogout={handleLogout}
            onNavigateToClients={() => setCurrentPage('auth')}
            onNavigateToPhotobook={() => setCurrentPage('auth')}
            onOpenAddClient={() => setCurrentPage('auth')}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-50/30 to-blue-50/30">
      <AppNavigation
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        isVerified={isVerified}
        onLogout={handleLogout}
      />

      {showEmailVerification && userId && !isAdmin && (
        <EmailVerificationDialog
          open={showEmailVerification}
          onClose={() => setShowEmailVerification(false)}
          onVerified={() => {
            setEmailVerified(true);
            setShowEmailVerification(false);
          }}
          userId={userId.toString()}
          userEmail={userEmail}
          isVerified={emailVerified}
        />
      )}

      <OnboardingTour currentPage={currentPage} onPageChange={setCurrentPage} />

      {userId && isAuthenticated && (
        <>
          {isAdmin && <FloatingAppealsButton userId={userId} isAdmin={isAdmin} />}
          {hasVerifiedPhone ? (
            <WhatsAppMessenger userId={userId} />
          ) : (
            <Button
              onClick={() => {
                toast.info('Для использования WhatsApp подтвердите телефон', {
                  description: 'Перейдите в Настройки → Укажите и подтвердите телефон',
                  action: {
                    label: 'Настройки',
                    onClick: () => setCurrentPage('settings')
                  },
                  duration: 6000
                });
              }}
              className="fixed bottom-6 right-6 rounded-full shadow-2xl z-50 h-14 w-14 p-0"
              size="lg"
              variant="secondary"
              title="Подтвердите телефон для доступа к WhatsApp"
            >
              <div className="relative">
                <Icon name="MessageCircle" size={24} className="opacity-50" />
                <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full w-4 h-4 flex items-center justify-center">
                  <Icon name="Lock" size={12} className="text-white" />
                </div>
              </div>
            </Button>
          )}
        </>
      )}

      {selectedBookingId && (
        <BookingDetailsDialog
          open={isBookingDetailsOpen}
          onOpenChange={setIsBookingDetailsOpen}
          bookingId={selectedBookingId}
          userId={userId?.toString() || null}
        />
      )}

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        {!emailVerified && hasEmail && currentPage === 'dashboard' && !isAdmin && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Icon name="Mail" className="text-amber-600" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-1">Подтвердите почту</h3>
                <p className="text-sm text-amber-700 mb-3">
                  Для полноценной работы на платформе необходимо подтвердить ваш email-адрес
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowEmailVerification(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                >
                  <Icon name="CheckCircle2" size={16} className="mr-2" />
                  Подтвердить сейчас
                </Button>
              </div>
              <button
                onClick={() => {
                  const dismissedKey = `email_verification_dismissed_${userId}`;
                  localStorage.setItem(dismissedKey, 'true');
                  setShowEmailVerification(false);
                }}
                className="text-amber-600 hover:text-amber-800 transition-colors"
              >
                <Icon name="X" size={20} />
              </button>
            </div>
          </div>
        )}
        
        {currentPage === 'dashboard' && (
          <Dashboard 
            userRole="user"
            userId={userId?.toString() || null}
            onOpenClientBooking={(clientName) => {
              setSelectedClientName(clientName);
              setCurrentPage('clients');
            }}
            onMeetingClick={(meetingId) => {
              setSelectedBookingId(meetingId);
              setIsBookingDetailsOpen(true);
            }}
            onLogout={handleLogout}
            onOpenAdminPanel={() => setCurrentPage('admin')}
            onOpenTariffs={() => setCurrentPage('tariffs')}
            onNavigateToClients={() => setCurrentPage('clients')}
            onNavigateToPhotobook={() => setCurrentPage('photobook')}
            onOpenAddClient={() => setCurrentPage('clients')}
            isAdmin={isAdmin}
          />
        )}
        {currentPage === 'clients' && <ClientsPage autoOpenClient={selectedClientName} userId={userId?.toString() || null} />}
        {currentPage === 'photobook' && <PhotobookPage />}
        {currentPage === 'features' && <FeaturesPage />}
        {currentPage === 'tariffs' && <TariffsPage userId={userId} />}
        {currentPage === 'settings' && userId && <SettingsPage userId={userId} />}
        {currentPage === 'help' && <HelpPage />}
        {currentPage === 'admin' && isAdmin && <AdminPanel />}
      </main>
      
      <MobileNavigation onNavigate={setCurrentPage} currentPage={currentPage} />
    </div>
  );
};

export default Index;