import LoginBackground from '@/components/login/LoginBackground';
import LoginCard from '@/components/login/LoginCard';
import LoginFormFields from '@/components/login/LoginFormFields';
import OAuthProviders from '@/components/login/OAuthProviders';
import BiometricLoginButton from '@/components/login/BiometricLoginButton';
import BiometricOverlay from '@/components/login/BiometricOverlay';
import LoginDialogs from '@/components/login/LoginDialogs';
import NewYearDecorations from '@/components/NewYearDecorations';
import useLoginState from '@/components/login/useLoginState';

interface LoginPageProps {
  onLoginSuccess: (userId: number, email?: string, token?: string) => void;
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const state = useLoginState({ onLoginSuccess });

  if (state.showBiometricOverlay) {
    return (
      <BiometricOverlay
        backgroundImage={state.backgroundImage}
        backgroundOpacity={state.backgroundOpacity}
        autoAuthState={state.autoAuthState}
        onTriggerAuth={state.triggerBiometricAuth}
        onDismiss={() => state.setShowBiometricOverlay(false)}
      />
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundColor: '#f8f9fa',
      }}
    >
      <LoginBackground 
        backgroundImage={state.backgroundImage} 
        backgroundOpacity={state.backgroundOpacity} 
      />

      {state.showGarland && <NewYearDecorations />}

      <LoginCard isRegistering={state.isRegistering}>
        <LoginFormFields
          email={state.email}
          password={state.password}
          showPassword={state.showPassword}
          isRegistering={state.isRegistering}
          phone={state.phone}
          isBlocked={state.isBlocked}
          remainingAttempts={state.remainingAttempts}
          blockTimeRemaining={state.blockTimeRemaining}
          passwordError={state.passwordError}
          loginAttemptFailed={state.loginAttemptFailed}
          privacyAccepted={state.privacyAccepted}
          onEmailChange={state.setEmail}
          onPasswordChange={state.handlePasswordChange}
          onPhoneChange={state.setPhone}
          onShowPasswordToggle={() => state.setShowPassword(!state.showPassword)}
          onSubmit={state.isRegistering ? state.handleRegister : state.handleLogin}
          onToggleMode={state.handleToggleMode}
          onForgotPassword={() => state.setShowForgotPassword(true)}
          onPrivacyAcceptedChange={state.setPrivacyAccepted}
          onPrivacyPolicyClick={() => state.setShowPrivacyPolicy(true)}
          formatTime={state.formatTime}
        />

        <OAuthProviders
          authProviders={state.authProviders}
          isBlocked={state.isBlocked}
          privacyAccepted={state.privacyAccepted}
          onLoginSuccess={onLoginSuccess}
          onOAuthLogin={state.handleOAuthLogin}
        />

        <BiometricLoginButton
          onLoginSuccess={onLoginSuccess}
          biometricGlobalEnabled={state.biometricEnabled}
          autoAuthState={state.autoAuthState}
        />
      </LoginCard>

      <LoginDialogs
        is2FADialogOpen={state.is2FADialogOpen}
        pendingUserId={state.pendingUserId}
        twoFactorType={state.twoFactorType}
        onHandle2FASuccess={state.handle2FASuccess}
        onHandle2FACancel={state.handle2FACancel}
        showForgotPassword={state.showForgotPassword}
        onCloseForgotPassword={() => state.setShowForgotPassword(false)}
        showPrivacyPolicy={state.showPrivacyPolicy}
        onClosePrivacyPolicy={() => state.setShowPrivacyPolicy(false)}
        showBiometricPrompt={state.showBiometricPrompt}
        biometricUserData={state.biometricUserData}
        onCloseBiometricPrompt={() => state.setShowBiometricPrompt(false)}
        showAppealDialog={state.showAppealDialog}
        onSetShowAppealDialog={state.setShowAppealDialog}
        blockedUserData={state.blockedUserData}
      />
    </div>
  );
};

export default LoginPage;
