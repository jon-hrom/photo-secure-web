import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import Dashboard from '@/components/Dashboard';
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
import MAXMessenger from '@/components/MAXMessenger';
import BookingDetailsDialog from '@/components/BookingDetailsDialog';
import SyncIndicator from '@/components/SyncIndicator';

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
  hasEmail,
  hasVerifiedPhone,
  onLogout,
}: AuthenticatedLayoutProps) => {
  const [selectedClientName, setSelectedClientName] = useState<string | undefined>(undefined);
  const [shouldOpenAddClient, setShouldOpenAddClient] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [showMAX, setShowMAX] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-50/30 to-blue-50/30">
      <AppNavigation
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        isVerified={isVerified}
        onLogout={onLogout}
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

      {userId && (
        <>
          {isAdmin && <FloatingAppealsButton userId={userId} isAdmin={isAdmin} />}
          {hasVerifiedPhone && (
            <MAXMessenger userId={userId} isOpen={showMAX} onClose={() => setShowMAX(false)} />
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

      {(currentPage === 'dashboard' || currentPage === 'clients') && (
        <SyncIndicator 
          isLoading={clientsLoading} 
          lastSyncTime={lastSyncTime}
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
            onOpenAddClient={() => {
              setShouldOpenAddClient(true);
              setCurrentPage('clients');
            }}
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
          />
        )}
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

export default AuthenticatedLayout;
