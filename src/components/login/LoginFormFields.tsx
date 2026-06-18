import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { fetchLegalList, LegalDocMeta } from '@/lib/legalApi';

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

const slugToUrl: Record<string, string> = {
  'offer': '/offer',
  'privacy-policy': '/privacy-policy',
  'personal-data': '/personal-data',
};

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
  const [legalDocs, setLegalDocs] = useState<LegalDocMeta[]>([]);
  const [docConsents, setDocConsents] = useState<Record<string, boolean>>({});
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    fetchLegalList().then((docs) => {
      setLegalDocs(docs);
      const initial: Record<string, boolean> = {};
      docs.forEach((d) => { initial[d.slug] = false; });
      setDocConsents(initial);
    });
  }, []);

  const allDocsAccepted = legalDocs.length === 0 || legalDocs.every((d) => docConsents[d.slug]);

  useEffect(() => {
    onPrivacyAcceptedChange(allDocsAccepted);
  }, [allDocsAccepted]);

  const handleSubmitClick = () => {
    if (!allDocsAccepted) {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 1600);
      return;
    }
    onSubmit();
  };

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
          <Label htmlFor="email" className="dark:text-gray-200">{isRegistering ? 'Email' : 'Email или телефон'}</Label>
          <Input
            id="email"
            type={isRegistering ? 'email' : 'text'}
            inputMode="email"
            autoComplete="username"
            placeholder={isRegistering ? 'example@mail.com' : 'example@mail.com или +7...'}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={isBlocked}
            className="rounded-xl dark:bg-gray-800 dark:text-white dark:border-gray-700 h-11"
          />
          {!isRegistering && (
            <p className="text-xs text-muted-foreground dark:text-gray-400">Можно войти по email или телефону</p>
          )}
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
              className="rounded-xl pr-10 dark:bg-gray-800 dark:text-white dark:border-gray-700 h-11"
              onKeyDown={(e) => e.key === 'Enter' && !isRegistering && handleSubmitClick()}
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
              className="rounded-xl dark:bg-gray-800 dark:text-white dark:border-gray-700 h-11"
              required
            />
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              <Icon name="Info" size={12} className="inline mr-1" />
              Обязательное поле для регистрации
            </p>
          </div>
        )}

        <div className="space-y-3">
          {legalDocs.map((doc) => {
            const checked = docConsents[doc.slug] ?? false;
            const shouldBlink = blinking && !checked;
            return (
              <div key={doc.slug} className="flex items-start gap-2">
                <Checkbox
                  id={`consent-${doc.slug}`}
                  checked={checked}
                  onCheckedChange={(v) =>
                    setDocConsents((prev) => ({ ...prev, [doc.slug]: !!v }))
                  }
                  disabled={isBlocked}
                  className={`mt-1 ${shouldBlink ? 'animate-blink-attention border-red-500 ring-2 ring-red-500/50' : ''}`}
                />
                <label
                  htmlFor={`consent-${doc.slug}`}
                  className={`text-sm leading-relaxed transition-colors ${
                    shouldBlink ? 'text-red-500 font-medium' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Я принимаю{' '}
                  <a
                    href={slugToUrl[doc.slug] || `/legal/${doc.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {doc.title}
                  </a>
                </label>
              </div>
            );
          })}

          <Button
            onClick={handleSubmitClick}
            disabled={isBlocked}
            className="w-full rounded-xl h-11"
            size="default"
          >
            {isRegistering ? 'Зарегистрироваться' : 'Войти'}
          </Button>
        </div>

        <Button
          variant="secondary"
          onClick={onToggleMode}
          className="w-full rounded-xl bg-zinc-900 text-white/60 border border-zinc-700 transition-all duration-500 ease-out hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 hover:text-white hover:border-transparent hover:shadow-lg hover:shadow-purple-500/50 hover:scale-[1.02]"
        >
          {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </Button>

        {loginAttemptFailed && !isBlocked && !isRegistering && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-300 dark:border-orange-700 rounded-xl">
              <p className="text-sm text-orange-700 dark:text-orange-300 flex items-start gap-2">
                <Icon name="Info" size={16} className="mt-0.5 shrink-0" />
                <span>Не помните пароль? Восстановите его — мы отправим код на email или SMS.</span>
              </p>
            </div>
            <Button
              type="button"
              onClick={onForgotPassword}
              variant="outline"
              className="w-full rounded-xl h-11 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold"
            >
              <Icon name="KeyRound" size={18} className="mr-2" />
              Восстановить пароль
            </Button>
          </div>
        )}

        {!loginAttemptFailed && !isBlocked && !isRegistering && (
          <button
            type="button"
            onClick={onForgotPassword}
            className="w-full text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-2 justify-center"
          >
            <Icon name="KeyRound" size={14} />
            Забыли пароль?
          </button>
        )}
      </div>
    </div>
  );
};

export default LoginFormFields;