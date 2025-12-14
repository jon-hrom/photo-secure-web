import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onPhoneChange: (phone: string) => void;
  onShowPasswordToggle: () => void;
  onSubmit: () => void;
  onToggleMode: () => void;
  onForgotPassword: () => void;
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
  onEmailChange,
  onPasswordChange,
  onPhoneChange,
  onShowPasswordToggle,
  onSubmit,
  onToggleMode,
  onForgotPassword,
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
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={isBlocked}
            className="rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              disabled={isBlocked}
              className="rounded-xl pr-10"
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
            <Label htmlFor="phone">Телефон *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="rounded-xl"
              required
            />
            <p className="text-xs text-muted-foreground">
              <Icon name="Info" size={12} className="inline mr-1" />
              Обязательное поле для регистрации
            </p>
          </div>
        )}

        <Button
          onClick={onSubmit}
          disabled={isBlocked}
          className="w-full rounded-xl"
        >
          {isRegistering ? 'Зарегистрироваться' : 'Войти'}
        </Button>

        <Button
          variant="ghost"
          onClick={onToggleMode}
          className="w-full rounded-xl"
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
