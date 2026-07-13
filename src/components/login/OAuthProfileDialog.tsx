import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import RegistrationPendingDialog from '@/components/login/RegistrationPendingDialog';

const AUTH_URL = 'https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9';

interface OAuthProfileDialogProps {
  open: boolean;
  userId: number;
  provider: 'vk' | 'yandex' | 'telegram';
  presetEmail?: string;
  presetPhone?: string;
  onDone: () => void;
}

const OAuthProfileDialog = ({ open, userId, provider, presetEmail, presetPhone, onDone }: OAuthProfileDialogProps) => {
  const [email, setEmail] = useState(presetEmail || '');
  const [phone, setPhone] = useState(presetPhone || '');
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [showPending, setShowPending] = useState(false);

  const updateLink = (index: number, value: string) => {
    setPortfolioLinks((prev) => prev.map((l, i) => (i === index ? value : l)));
  };
  const addLink = () => setPortfolioLinks((prev) => [...prev, '']);
  const removeLink = (index: number) =>
    setPortfolioLinks((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    const cleanLinks = portfolioLinks.map((l) => l.trim()).filter(Boolean);
    const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());
    if (!emailValid) {
      toast.error('Введите корректный email, например name@mail.ru');
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '').replace(/^[78]/, '');
    if (phoneDigits.length !== 10) {
      toast.error('Введите корректный телефон: +7 и 10 цифр');
      return;
    }
    if (cleanLinks.length === 0) {
      toast.error('Укажите хотя бы одну ссылку на портфолио');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete-oauth-profile',
          user_id: userId,
          provider,
          email: email.trim(),
          phone: phone.trim(),
          portfolio_links: cleanLinks,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // Аккаунт объединён со старым и уже одобрен — сразу входим
        if (data.merged && data.token && data.userId) {
          localStorage.setItem('auth_token', data.token);
          if (data.session_id) localStorage.setItem('auth_session_id', data.session_id);
          localStorage.setItem('userId', String(data.userId));
          toast.success('С возвращением! Вы вошли в свой аккаунт');
          setTimeout(() => { window.location.href = '/'; }, 600);
          return;
        }
        // Иначе — заявка на проверку
        setShowPending(true);
      } else {
        toast.error(data.error || 'Не удалось отправить заявку');
      }
    } catch {
      toast.error('Ошибка отправки. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  if (showPending) {
    return (
      <RegistrationPendingDialog
        open={true}
        email={email.trim()}
        onClose={onDone}
      />
    );
  }

  const providerName = provider === 'vk' ? 'ВКонтакте' : provider === 'telegram' ? 'Telegram' : 'Яндекс';

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md rounded-2xl" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="UserCheck" size={22} className="text-primary" />
            Заполните данные фотографа
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Вы вошли через {providerName}. Чтобы получить доступ, укажите контакты и ссылку на
          портфолио — администратор проверит вашу заявку.
        </p>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="oauth-email">Email</Label>
            <Input
              id="oauth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="oauth-phone">Телефон</Label>
            <Input
              id="oauth-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Ссылки на портфолио</Label>
            {portfolioLinks.map((link, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="url"
                  value={link}
                  onChange={(e) => updateLink(index, e.target.value)}
                />
                {portfolioLinks.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => removeLink(index)}
                  >
                    <Icon name="X" size={18} />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLink} className="gap-1.5">
              <Icon name="Plus" size={16} />
              Добавить ссылку
            </Button>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full h-11 rounded-xl">
            {submitting ? 'Отправка…' : 'Отправить на проверку'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OAuthProfileDialog;