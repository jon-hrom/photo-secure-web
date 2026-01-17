import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';

interface LoginFormFieldsProps {
  email: string;
  password: string;
  showPassword: boolean;
  isRegistering: boolean;
  phone: string;
  isBlocked: boolean;
  remainingAttempts: number;
  blockTimeRemaining: number;
  passwordError: string;
  loginAttemptFailed: boolean;
  privacyAccepted: boolean;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onPhoneChange: (phone: string) => void;
  onShowPasswordToggle: () => void;
  onSubmit: () => void;
  onToggleMode: () => void;
  onForgotPassword: () => void;
  onPrivacyAcceptedChange: (accepted: boolean) => void;
  onPrivacyPolicyClick: () => void;
  formatTime: (seconds: number) => string;
}

const LoginFormFields = ({
  email,
  password,
  showPassword,
  isRegistering,
  phone,
  isBlocked,
  remainingAttempts,
  blockTimeRemaining,
  passwordError,
  loginAttemptFailed,
  privacyAccepted,
  onEmailChange,
  onPasswordChange,
  onPhoneChange,
  onShowPasswordToggle,
  onSubmit,
  onToggleMode,
  onForgotPassword,
  onPrivacyAcceptedChange,
  onPrivacyPolicyClick,
  formatTime,
}: LoginFormFieldsProps) => {
  const handlePasswordChange = (value: string) => {
    onPasswordChange(value);
  };

  return (
    <div className="space-y-6">
      {isBlocked && (
        <div className="p-4 bg-destructive/10 border-2 border-destructive rounded-xl text-center">
          <Icon name="ShieldAlert" size={32} className="text-destructive mx-auto mb-2" />
          <p className="font-bold text-destructive">Доступ временно заблокирован</p>
          <p className="text-2xl font-mono font-bold mt-2">{formatTime(blockTimeRemaining)}</p>
        </div>
      )}

      {!isBlocked && remainingAttempts < 5 && (
        <div className="p-3 bg-orange-50 border-2 border-orange-300 rounded-xl">
          <p className="text-sm text-orange-700 flex items-center gap-2">
            <Icon name="AlertTriangle" size={16} />
            Осталось попыток: <strong>{remainingAttempts}</strong>
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="dark:text-gray-200">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={isBlocked}
            className="rounded-xl dark:bg-gray-800 dark:text-white dark:border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="dark:text-gray-200">Пароль</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              disabled={isBlocked}
              className="rounded-xl pr-10 dark:bg-gray-800 dark:text-white dark:border-gray-700"
              onKeyDown={(e) => e.key === 'Enter' && !isRegistering && onSubmit()}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={onShowPasswordToggle}
              disabled={isBlocked}
            >
              <Icon name={showPassword ? "EyeOff" : "Eye"} size={18} className="text-muted-foreground" />
            </Button>
          </div>
          {isRegistering && passwordError && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <Icon name="AlertCircle" size={14} />
              {passwordError}
            </p>
          )}
        </div>

        {isRegistering && (
          <div className="space-y-2">
            <Label htmlFor="phone" className="dark:text-gray-200">Телефон *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="rounded-xl dark:bg-gray-800 dark:text-white dark:border-gray-700"
              required
            />
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              <Icon name="Info" size={12} className="inline mr-1" />
              Обязательное поле для регистрации
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="privacy-policy"
              checked={privacyAccepted}
              onCheckedChange={onPrivacyAcceptedChange}
              disabled={isBlocked}
              className="mt-1"
            />
            <label
              htmlFor="privacy-policy"
              className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed"
            >
              Я согласен с условиями обработки{' '}
              <a
                href="https://foto-mix.ru/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Персональных данных
              </a>
            </label>
          </div>

          <Button
            onClick={onSubmit}
            disabled={isBlocked || !privacyAccepted}
            className="w-full rounded-xl h-11"
            size="default"
          >
            {isRegistering ? 'Зарегистрироваться' : 'Войти'}
          </Button>
        </div>

        <Button
          variant="secondary"
          onClick={onToggleMode}
          className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
        >
          {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </Button>

        {loginAttemptFailed && !isBlocked && !isRegistering && (
          <button
            onClick={onForgotPassword}
            className="w-full text-sm text-primary hover:underline flex items-center gap-2 justify-center"
          >
            <Icon name="KeyRound" size={16} />
            Забыли пароль? Восстановить
          </button>
        )}
      </div>
    </div>
  );
};

export default LoginFormFields;