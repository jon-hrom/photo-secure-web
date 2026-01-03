import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import VKAuthButton from '@/components/VKAuthButton';

interface LoginFormProps {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  onLogin: () => void;
  onVKSuccess: (userId: number, email?: string) => void;
  authProviders: {
    yandex: boolean;
    vk: boolean;
    google: boolean;
  };
  isBlocked: boolean;
  blockTimeRemaining: number;
  formatTime: (seconds: number) => string;
  loginAttemptFailed: boolean;
  onForgotPasswordClick: () => void;
  onPrivacyPolicyClick: () => void;
}

const LoginForm = ({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  onLogin,
  onVKSuccess,
  authProviders,
  isBlocked,
  blockTimeRemaining,
  formatTime,
  loginAttemptFailed,
  onForgotPasswordClick,
  onPrivacyPolicyClick,
}: LoginFormProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isBlocked}
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Пароль</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isBlocked}
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isBlocked) {
                onLogin();
              }
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground w-11 h-11 flex items-center justify-center touch-manipulation"
            disabled={isBlocked}
            aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
          >
            <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={20} />
          </button>
        </div>
        {loginAttemptFailed && (
          <p className="text-sm text-muted-foreground mt-2">
            Забыли пароль?{' '}
            <button
              onClick={onForgotPasswordClick}
              className="text-primary hover:underline"
            >
              Восстановить
            </button>
          </p>
        )}
      </div>
      <Button 
        onClick={onLogin} 
        className="w-full" 
        disabled={isBlocked}
      >
        {isBlocked ? `Заблокировано (${formatTime(blockTimeRemaining)})` : 'Войти'}
      </Button>

      {authProviders.vk && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Или войдите через</span>
            </div>
          </div>
          <VKAuthButton onSuccess={onVKSuccess} disabled={isBlocked} />
        </>
      )}
      <p className="text-xs text-center text-muted-foreground">
        Используя сервис, вы соглашаетесь с{' '}
        <button
          type="button"
          onClick={onPrivacyPolicyClick}
          className="text-primary hover:underline"
        >
          Политикой обработки персональных данных
        </button>
      </p>
    </>
  );
};

export default LoginForm;