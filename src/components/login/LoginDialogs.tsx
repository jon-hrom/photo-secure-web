import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TwoFactorDialog from '@/components/TwoFactorDialog';
import BlockedUserAppeal from '@/components/BlockedUserAppeal';
import ForgotPasswordDialog from '@/components/ForgotPasswordDialog';
import PrivacyPolicyDialog from '@/components/PrivacyPolicyDialog';
import BiometricPromptDialog from '@/components/BiometricPromptDialog';

interface LoginDialogsProps {
  is2FADialogOpen: boolean;
  pendingUserId: number | null;
  twoFactorType: 'email';
  onHandle2FASuccess: () => void;
  onHandle2FACancel: () => void;
  showForgotPassword: boolean;
  onCloseForgotPassword: () => void;
  showPrivacyPolicy: boolean;
  onClosePrivacyPolicy: () => void;
  showBiometricPrompt: boolean;
  biometricUserData: { userId: number; email: string; token?: string } | null;
  onCloseBiometricPrompt: () => void;
  showAppealDialog: boolean;
  onSetShowAppealDialog: (open: boolean) => void;
  blockedUserData: {
    userId?: number;
    userEmail?: string;
    authMethod?: string;
  } | null;
}

const LoginDialogs = ({
  is2FADialogOpen,
  pendingUserId,
  twoFactorType,
  onHandle2FASuccess,
  onHandle2FACancel,
  showForgotPassword,
  onCloseForgotPassword,
  showPrivacyPolicy,
  onClosePrivacyPolicy,
  showBiometricPrompt,
  biometricUserData,
  onCloseBiometricPrompt,
  showAppealDialog,
  onSetShowAppealDialog,
  blockedUserData,
}: LoginDialogsProps) => {
  return (
    <>
      {is2FADialogOpen && pendingUserId && (
        <TwoFactorDialog
          open={is2FADialogOpen}
          userId={pendingUserId}
          type={twoFactorType}
          onSuccess={onHandle2FASuccess}
          onCancel={onHandle2FACancel}
        />
      )}

      <ForgotPasswordDialog 
        open={showForgotPassword} 
        onClose={onCloseForgotPassword}
      />

      <PrivacyPolicyDialog
        open={showPrivacyPolicy}
        onClose={onClosePrivacyPolicy}
      />

      {biometricUserData && (
        <BiometricPromptDialog
          open={showBiometricPrompt}
          userData={biometricUserData}
          onClose={onCloseBiometricPrompt}
        />
      )}

      <Dialog open={showAppealDialog} onOpenChange={onSetShowAppealDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Форма обращения к администратору</DialogTitle>
          </DialogHeader>
          <BlockedUserAppeal
            userId={blockedUserData?.userId}
            userEmail={blockedUserData?.userEmail}
            authMethod={blockedUserData?.authMethod}
            onClose={() => onSetShowAppealDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoginDialogs;
