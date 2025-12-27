import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface RegisterFormProps {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  phone: string;
  setPhone: (value: string) => void;
  passwordError: string;
  onRegister: () => void;
  onPrivacyPolicyClick: () => void;
}

const RegisterForm = ({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  phone,
  setPhone,
  passwordError,
  onRegister,
  onPrivacyPolicyClick,
}: RegisterFormProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">Пароль</Label>
        <div className="relative">
          <Input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Минимум 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={18} />
          </button>
        </div>
        {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Телефон</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+7 (999) 123-45-67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <Button onClick={onRegister} className="w-full">
        Зарегистрироваться
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        Регистрируясь, вы соглашаетесь с{' '}
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

export default RegisterForm;