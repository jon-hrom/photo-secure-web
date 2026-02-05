import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MaintenancePage from '@/components/MaintenancePage';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import UnauthenticatedViews from '@/components/layout/UnauthenticatedViews';
import AccessDeniedNotification from '@/components/AccessDeniedNotification';
import SessionTimeoutWarning from '@/components/SessionTimeoutWarning';
import TelegramBanner from '@/components/TelegramBanner';
import { useAuth } from '@/hooks/useAuth';
import { useActivityTracking } from '@/hooks/useActivityTracking';
import { useClientsSync } from '@/hooks/useClientsSync';
import { useVerificationChecks } from '@/hooks/useVerificationChecks';
import { useSessionWatcher } from '@/hooks/useSessionWatcher';
import { settingsSync } from '@/utils/settingsSync';
import { toast } from 'sonner';

const Index = () => {
  const [searchParams] = useSearchParams();
  // Отслеживаем изменения сессии для автоматической очистки admin viewing
  useSessionWatcher();
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
    showAccessDenied,
    accessDeniedMessage,
    needsTelegramVerification,
    setNeedsTelegramVerification,
    setShowAccessDenied,
    setNeeds2FA,
    setIsBlocked,
    lastActivityRef,
    handleLoginSuccess,
    handleLogout,
  } = useAuth();

  const { clients, setClients, clientsLoading, lastSyncTime } = useClientsSync({
    isAuthenticated,
    userId,
  });

  const {
    showEmailVerification,
    setShowEmailVerification,
    emailVerified,
    setEmailVerified,
    hasEmail,
    hasVerifiedPhone,
  } = useVerificationChecks({
    isAuthenticated,
    userId,
    currentPage,
    isAdmin,
  });

  useActivityTracking({
    isAuthenticated,
    userEmail,
    lastActivityRef,
    onLogout: handleLogout
  });

  // Обработка URL параметра filter=no-date
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'no-date' && isAuthenticated) {
      setCurrentPage('clients');
    }
  }, [searchParams, isAuthenticated, setCurrentPage]);

  useEffect(() => {
    settingsSync.onUpdate(() => {
      toast.info('Доступны обновления настроек', {
        description: 'Перезагрузите страницу, чтобы применить изменения',
        action: {
          label: 'Обновить',
          onClick: () => window.location.reload()
        },
        duration: 30000,
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
    return (
      <UnauthenticatedViews
        guestAccess={guestAccess}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        needs2FA={needs2FA}
        setNeeds2FA={setNeeds2FA}
        pendingUserData={pendingUserData}
        isBlocked={isBlocked}
        setIsBlocked={setIsBlocked}
        blockReason={blockReason}
        blockData={blockData}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    );
  }

  const handleExtendSession = () => {
    lastActivityRef.current = Date.now();
    const savedSession = localStorage.getItem('authSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        localStorage.setItem('authSession', JSON.stringify({
          ...session,
          lastActivity: Date.now(),
        }));
      } catch (error) {
        console.error('[SESSION] Error extending session:', error);
      }
    }
  };

  if (showAccessDenied) {
    return <AccessDeniedNotification message={accessDeniedMessage} onClose={() => setShowAccessDenied(false)} />;
  }

  if (!isAuthenticated && guestAccess && currentPage === 'auth') {
    return (
      <UnauthenticatedViews
        guestAccess={guestAccess}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        needs2FA={needs2FA}
        setNeeds2FA={setNeeds2FA}
        pendingUserData={pendingUserData}
        isBlocked={isBlocked}
        setIsBlocked={setIsBlocked}
        blockReason={blockReason}
        blockData={blockData}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    );
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
      <UnauthenticatedViews
        guestAccess={guestAccess}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        needs2FA={needs2FA}
        setNeeds2FA={setNeeds2FA}
        pendingUserData={pendingUserData}
        isBlocked={isBlocked}
        setIsBlocked={setIsBlocked}
        blockReason={blockReason}
        blockData={blockData}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <>
      {isAuthenticated && (
        <SessionTimeoutWarning
          onExtendSession={handleExtendSession}
          onLogout={handleLogout}
        />
      )}
      {isAuthenticated && userId && !isAdmin && <TelegramBanner userId={userId} />}
      <AuthenticatedLayout
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        isVerified={isVerified}
        isAdmin={isAdmin}
        userId={userId}
        clients={clients}
        setClients={setClients}
        clientsLoading={clientsLoading}
        lastSyncTime={lastSyncTime}
        showEmailVerification={showEmailVerification}
        setShowEmailVerification={setShowEmailVerification}
        emailVerified={emailVerified}
        setEmailVerified={setEmailVerified}
        hasEmail={hasEmail}
        hasVerifiedPhone={hasVerifiedPhone}
        onLogout={handleLogout}
      />
    </>
  );
};

export default Index;