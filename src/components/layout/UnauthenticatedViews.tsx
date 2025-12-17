import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import Dashboard from '@/components/Dashboard';
import LoginPage from '@/components/LoginPage';
import TwoFactorDialog from '@/components/TwoFactorDialog';
import BlockedUserDialog from '@/components/BlockedUserDialog';

interface UnauthenticatedViewsProps {
  guestAccess: boolean;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  needs2FA: boolean;
  setNeeds2FA: (needs: boolean) => void;
  pendingUserData: any;
  isBlocked: boolean;
  setIsBlocked: (blocked: boolean) => void;
  blockReason: string | null;
  blockData: any;
  onLoginSuccess: (userId: string | number, email?: string) => void;
  onLogout: () => void;
}

const UnauthenticatedViews = ({
  guestAccess,
  currentPage,
  setCurrentPage,
  needs2FA,
  setNeeds2FA,
  pendingUserData,
  isBlocked,
  setIsBlocked,
  blockReason,
  blockData,
  onLoginSuccess,
  onLogout,
}: UnauthenticatedViewsProps) => {
  if (isBlocked && blockData) {
    return (
      <>
        <LoginPage onLoginSuccess={onLoginSuccess} />
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

  if (!guestAccess) {
    return (
      <>
        <LoginPage onLoginSuccess={onLoginSuccess} />
        {needs2FA && pendingUserData && (
          <TwoFactorDialog
            open={needs2FA}
            userId={pendingUserData.user_id || pendingUserData.vk_id}
            userEmail={pendingUserData.email || ''}
            type="email"
            onSuccess={() => {
              setNeeds2FA(false);
              onLoginSuccess(
                pendingUserData.user_id || pendingUserData.vk_id,
                pendingUserData.email
              );
            }}
            onCancel={() => {
              setNeeds2FA(false);
              onLogout();
            }}
          />
        )}
      </>
    );
  }

  if (currentPage === 'auth') {
    return <LoginPage onLoginSuccess={onLoginSuccess} />;
  }

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
          onLogout={onLogout}
          onNavigateToClients={() => setCurrentPage('auth')}
          onNavigateToPhotobook={() => setCurrentPage('auth')}
        />
      </main>
    </div>
  );
};

export default UnauthenticatedViews;
