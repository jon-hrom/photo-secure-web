import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerPush } from '@/lib/push';
import LegalConsentModal from '@/components/legal/LegalConsentModal';
import LegalFooter from '@/components/legal/LegalFooter';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useSupportUnread } from '@/hooks/useSupportUnread';
import Dashboard from '@/components/Dashboard';
import PhotographerChatsModal from '@/components/photobank/PhotographerChatsModal';
import ClientsPage from '@/components/ClientsPage';
import PhotobookPage from '@/components/PhotobookPage';
import SettingsPage from '@/components/SettingsPage';
import FeaturesPage from '@/components/FeaturesPage';
import TariffsPage from '@/components/TariffsPage';
import HelpPage from '@/components/HelpPage';
import AdminPanel from '@/components/AdminPanel';
import AppNavigation from '@/components/layout/AppNavigation';
import MobileNavigation from '@/components/layout/MobileNavigation';
import EmailVerificationDialog from '@/components/EmailVerificationDialog';
import OnboardingTour from '@/components/OnboardingTour';
import FloatingAppealsButton from '@/components/FloatingAppealsButton';
import AdminTicketsButton from '@/components/support/AdminTicketsButton';
import BookingDetailsDialog from '@/components/BookingDetailsDialog';
import SyncIndicator from '@/components/SyncIndicator';
import WelcomeDialog from '@/components/WelcomeDialog';
import ToolsDialog from '@/components/tools/ToolsDialog';
import LogoRemoverDialog from '@/components/tools/LogoRemoverDialog';
import HumanizerDialog from '@/components/tools/HumanizerDialog';

const AUTH_URL = 'https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9';

interface AuthenticatedLayoutProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  userName: string;
  userEmail: string;
  userAvatar: string;
  isVerified: boolean;
  isAdmin: boolean;
  userId: string | number | null;
  clients: Client[];
  setClients: (clients: Client[]) => void;
  clientsLoading: boolean;
  lastSyncTime: Date | undefined;
  showEmailVerification: boolean;
  setShowEmailVerification: (show: boolean) => void;
  emailVerified: boolean;
  setEmailVerified: (verified: boolean) => void;
  verificationChecked: boolean;
  hasEmail: boolean;
  hasVerifiedPhone: boolean;
  onLogout: () => void;
}

const AuthenticatedLayout = ({
  currentPage,
  setCurrentPage,
  userName,
  userEmail,
  userAvatar,
  isVerified,
  isAdmin,
  userId,
  clients,
  setClients,
  clientsLoading,
  lastSyncTime,
  showEmailVerification,
  setShowEmailVerification,
  emailVerified,
  setEmailVerified,
  verificationChecked,
  hasEmail,
  hasVerifiedPhone,
  onLogout,
}: AuthenticatedLayoutProps) => {
  const navigate = useNavigate();
  const [selectedClientName, setSelectedClientName] = useState<string | undefined>(undefined);
  const [shouldOpenAddClient, setShouldOpenAddClient] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [showMAXChat, setShowMAXChat] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAdminTickets, setShowAdminTickets] = useState(false);
  const [adminTicketsUnread, setAdminTicketsUnread] = useState(0);
  const [appealsOpenSignal, setAppealsOpenSignal] = useState(0);
  const [showTools, setShowTools] = useState(false);
  const [showLogoRemover, setShowLogoRemover] = useState(false);
  const [showHumanizer, setShowHumanizer] = useState(false);
  const unreadCount = useUnreadCount(userId);
  const { unreadCount: supportUnread, markRead: markSupportRead } = useSupportUnread(userId);
  const totalUnread = unreadCount + supportUnread;

  useEffect(() => {
    if (userId) {
      const t = setTimeout(() => { registerPush(userId); }, 3000);
      return () => clearTimeout(t);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && localStorage.getItem('show_welcome') === '1') {
      setShowWelcome(true);
    }
  }, [userId]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.removeItem('show_welcome');
    if (userId) {
      fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
        body: JSON.stringify({ action: 'mark-welcome-seen', user_id: userId }),
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-purple-50/30 to-blue-50/30 dark:via-purple-900/10 dark:to-blue-900/10">
      <AppNavigation
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        isVerified={isVerified}
        userId={userId}
        onLogout={onLogout}
        unreadCount={totalUnread}
        onOpenChat={() => { setShowMAXChat(true); markSupportRead(); }}
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

      <WelcomeDialog
        open={showWelcome}
        userName={userName}
        onClose={handleCloseWelcome}
        onOpenSupport={() => { setShowMAXChat(true); markSupportRead(); }}
      />

      {userId && !isAdmin && <LegalConsentModal userId={userId} />}

      {userId && isAdmin && (
        <FloatingAppealsButton
          userId={Number(userId)}
          isAdmin={isAdmin}
          extraUnread={adminTicketsUnread}
          onOpenTickets={() => setShowAdminTickets(true)}
          openSignal={appealsOpenSignal}
        />
      )}
      {userId && isAdmin && (
        <AdminTicketsButton
          userId={Number(userId)}
          hideFab
          open={showAdminTickets}
          onOpenChange={setShowAdminTickets}
          onUnreadChange={setAdminTicketsUnread}
          onOpenAppeals={() => setAppealsOpenSignal((s) => s + 1)}
        />
      )}

      {selectedBookingId && (
        <BookingDetailsDialog
          open={isBookingDetailsOpen}
          onOpenChange={setIsBookingDetailsOpen}
          bookingId={selectedBookingId}
          userId={userId?.toString() || null}
        />
      )}

      {(currentPage === 'dashboard' || currentPage === 'clients') && (
        <SyncIndicator 
          isLoading={clientsLoading} 
          lastSyncTime={lastSyncTime}
        />
      )}

      <main className="flex-1 w-full mx-auto px-3 md:px-4 lg:px-6 xl:px-8 2xl:px-12 py-4 md:py-8">
        {verificationChecked && !emailVerified && hasEmail && currentPage === 'dashboard' && !isAdmin && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Icon name="Mail" className="text-amber-600" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Подтвердите почту</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
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
            clients={clients}
            onOpenClientBooking={(clientName) => {
              setSelectedClientName(clientName);
              setCurrentPage('clients');
            }}
            onMeetingClick={(meetingId) => {
              setSelectedBookingId(meetingId);
              setIsBookingDetailsOpen(true);
            }}
            onLogout={onLogout}
            onOpenAdminPanel={() => setCurrentPage('admin')}
            onOpenTariffs={() => setCurrentPage('tariffs')}
            onNavigateToClients={() => setCurrentPage('clients')}
            onNavigateToPhotobook={() => setCurrentPage('photobook')}
            onNavigateToPhotoBank={() => {
              console.log('[AUTH_LAYOUT] onNavigateToPhotoBank called');
              console.log('[AUTH_LAYOUT] Current localStorage admin_viewing_user:', localStorage.getItem('admin_viewing_user'));
              console.log('[AUTH_LAYOUT] Current localStorage admin_viewing_user_id:', localStorage.getItem('admin_viewing_user_id'));
              
              // Проверяем, просматривает ли админ чужой кабинет
              const adminViewingUser = localStorage.getItem('admin_viewing_user');
              if (adminViewingUser) {
                try {
                  const { userId: viewedUserId } = JSON.parse(adminViewingUser);
                  console.log('[AUTH_LAYOUT] Admin viewing user:', viewedUserId);
                  localStorage.setItem('admin_viewing_user_id', String(viewedUserId));
                  console.log('[AUTH_LAYOUT] Set admin_viewing_user_id to:', viewedUserId);
                } catch (e) {
                  console.error('[AUTH_LAYOUT] Failed to parse admin_viewing_user:', e);
                }
              }
              console.log('[AUTH_LAYOUT] Navigating to /photo-bank');
              navigate('/photo-bank');
            }}
            onOpenAddClient={() => {
              setShouldOpenAddClient(true);
              setCurrentPage('clients');
            }}
            onNavigateToSettings={() => setCurrentPage('settings')}
            onOpenTools={() => setShowTools(true)}
            isAdmin={isAdmin}
          />
        )}
        {currentPage === 'clients' && (
          <ClientsPage 
            autoOpenClient={selectedClientName} 
            autoOpenAddDialog={shouldOpenAddClient}
            onAddDialogClose={() => setShouldOpenAddClient(false)}
            userId={userId?.toString() || null}
            clients={clients}
            onClientsUpdate={setClients}
            onNavigateToTariffs={() => setCurrentPage('tariffs')}
          />
        )}
        {currentPage === 'photobook' && <PhotobookPage />}
        {currentPage === 'features' && <FeaturesPage />}
        {currentPage === 'tariffs' && <TariffsPage userId={userId} />}
        {currentPage === 'settings' && userId && <SettingsPage userId={userId} />}
        {currentPage === 'help' && <HelpPage />}
        {currentPage === 'admin' && isAdmin && <AdminPanel />}
      </main>

      <LegalFooter className="pb-20 md:pb-0" />

      <MobileNavigation
        onNavigate={setCurrentPage}
        currentPage={currentPage}
        unreadCount={totalUnread}
        onOpenChat={() => { setShowMAXChat(true); markSupportRead(); }}
        userId={userId}
      />

      {userId && (
        <PhotographerChatsModal
          isOpen={showMAXChat}
          onClose={() => setShowMAXChat(false)}
          photographerId={Number(userId)}
          onOpenSupport={markSupportRead}
          supportUnread={supportUnread}
        />
      )}

      <ToolsDialog
        open={showTools}
        onOpenChange={setShowTools}
        onOpenLogoRemover={() => setShowLogoRemover(true)}
        onOpenHumanizer={() => setShowHumanizer(true)}
      />

      <LogoRemoverDialog
        open={showLogoRemover}
        onOpenChange={setShowLogoRemover}
      />

      <HumanizerDialog
        open={showHumanizer}
        onOpenChange={setShowHumanizer}
        userId={userId?.toString() || null}
      />


    </div>
  );
};

export default AuthenticatedLayout;