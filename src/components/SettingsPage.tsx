import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import EmailVerificationDialog from '@/components/EmailVerificationDialog';

interface UserSettings {
  email: string;
  phone: string;
  two_factor_email: boolean;
  email_verified_at: string | null;
  source?: 'email' | 'vk' | 'google' | 'yandex';
}

interface SettingsPageProps {
  userId: number;
}

const SettingsPage = ({ userId }: SettingsPageProps) => {
  const [settings, setSettings] = useState<UserSettings>({
    email: '',
    phone: '',
    two_factor_email: false,
    email_verified_at: null,
    source: 'email',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [editedEmail, setEditedEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedPhone, setEditedPhone] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      const response = await fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`);
      const data = await response.json();
      
      if (response.ok) {
        setSettings(data);
        setEditedEmail(data.email || '');
        setEditedPhone(data.phone || '');
      } else {
        console.error('Settings load error:', { status: response.status, data });
        toast.error(data.error || 'Ошибка загрузки настроек');
      }
    } catch (error) {
      console.error('Settings load exception:', error);
      toast.error('Ошибка подключения к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle2FA = async (type: 'email', enabled: boolean) => {
    if (type === 'email' && enabled && !settings.email) {
      toast.error('Добавьте email для включения email-аутентификации');
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-2fa', userId, type, enabled }),
      });

      const data = await response.json();

      if (response.ok) {
        setSettings((prev) => ({
          ...prev,
          [`two_factor_${type}`]: enabled,
        }));
        toast.success(`Двухфакторная аутентификация через ${type === 'sms' ? 'SMS' : 'Email'} ${enabled ? 'включена' : 'отключена'}`);
      } else {
        toast.error(data.error || 'Ошибка изменения настроек');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('8')) {
      return '+7' + cleaned.substring(1);
    }
    if (cleaned.startsWith('7')) {
      return '+' + cleaned;
    }
    return '+7' + cleaned;
  };

  const handleUpdateContact = async (field: 'email' | 'phone', value: string) => {
    if (field === 'email') {
      setIsSavingEmail(true);
    } else {
      setIsSavingPhone(true);
    }
    
    try {
      const finalValue = field === 'phone' ? formatPhoneNumber(value) : value;
      
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-contact', userId, field, value: finalValue }),
      });

      const data = await response.json();

      if (response.ok) {
        setSettings((prev) => ({ ...prev, [field]: finalValue }));
        if (field === 'phone') {
          setEditedPhone(finalValue);
        } else if (field === 'email') {
          setEditedEmail(finalValue);
        }
        toast.success('Контактные данные обновлены');
      } else {
        toast.error(data.error || 'Ошибка обновления');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      if (field === 'email') {
        setIsSavingEmail(false);
      } else {
        setIsSavingPhone(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icon name="Loader2" size={48} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Icon name="Settings" size={32} className="text-primary" />
          <h1 className="text-3xl font-bold">Настройки</h1>
        </div>

        {showEmailVerification && (
          <EmailVerificationDialog
            open={showEmailVerification}
            onClose={() => setShowEmailVerification(false)}
            onVerified={async () => {
              setShowEmailVerification(false);
              await loadSettings();
            }}
            userId={userId.toString()}
            userEmail={settings.email}
            isVerified={!!settings.email_verified_at}
          />
        )}

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="User" size={24} />
              Контактная информация
            </CardTitle>
            <CardDescription>Управление вашими контактными данными</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={isEditingEmail ? editedEmail : settings.email}
                  onChange={(e) => {
                    setEditedEmail(e.target.value);
                    setIsEditingEmail(true);
                  }}
                  placeholder={settings.source !== 'email' ? 'Введите ваш email' : ''}
                  className="rounded-xl"
                  readOnly={settings.source === 'email' && !!settings.email}
                />
                {(isEditingEmail || (settings.source === 'vk' && !settings.email)) && (
                  <Button
                    onClick={async () => {
                      await handleUpdateContact('email', editedEmail);
                      setIsEditingEmail(false);
                      await loadSettings();
                    }}
                    className="rounded-xl"
                    disabled={!editedEmail.trim() || !editedEmail.includes('@') || isSavingEmail}
                  >
                    {isSavingEmail ? (
                      <Icon name="Loader2" size={18} className="animate-spin" />
                    ) : (
                      <Icon name="Save" size={18} />
                    )}
                  </Button>
                )}
              </div>
              {settings.email_verified_at ? (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200 animate-in fade-in slide-in-from-top-2 duration-500">
                  <Icon name="CheckCircle2" size={16} />
                  <span className="font-medium">Почта подтверждена</span>
                </div>
              ) : settings.email && settings.email.trim() ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Icon name="AlertCircle" size={16} />
                  <span className="font-medium">Email не подтверждён</span>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowEmailVerification(true)}
                    className="p-0 h-auto font-semibold underline text-amber-700 hover:text-amber-900 ml-auto"
                  >
                    Подтвердить
                  </Button>
                </div>
              ) : settings.source === 'vk' && editedEmail && editedEmail.trim() && editedEmail.includes('@') ? (
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Icon name="Info" size={16} />
                  <span className="font-medium">Сначала сохраните email, нажав кнопку справа ↪</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={isEditingPhone ? editedPhone : settings.phone}
                  onChange={(e) => {
                    setEditedPhone(e.target.value);
                    setIsEditingPhone(true);
                  }}
                  className="rounded-xl"
                  readOnly={!isEditingPhone && !!settings.phone}
                />
                {isEditingPhone ? (
                  <Button
                    onClick={async () => {
                      await handleUpdateContact('phone', editedPhone);
                      setIsEditingPhone(false);
                      await loadSettings();
                    }}
                    className="rounded-xl"
                    disabled={!editedPhone.trim() || isSavingPhone}
                  >
                    {isSavingPhone ? (
                      <Icon name="Loader2" size={18} className="animate-spin" />
                    ) : (
                      <Icon name="Save" size={18} />
                    )}
                  </Button>
                ) : settings.phone ? (
                  <Button
                    onClick={() => setIsEditingPhone(true)}
                    variant="outline"
                    className="rounded-xl"
                  >
                    <Icon name="Pencil" size={18} />
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      await handleUpdateContact('phone', editedPhone);
                      setIsEditingPhone(false);
                      await loadSettings();
                    }}
                    className="rounded-xl"
                    disabled={!editedPhone.trim()}
                  >
                    <Icon name="Save" size={18} />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Shield" size={24} />
              Безопасность
            </CardTitle>
            <CardDescription>Двухфакторная аутентификация</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="Mail" size={20} className="text-primary" />
                  <Label className="font-semibold">Email-аутентификация</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Код из 5 цифр будет отправлен на вашу почту
                </p>
              </div>
              <Switch
                checked={settings.two_factor_email}
                onCheckedChange={(checked) => handleToggle2FA('email', checked)}
                disabled={!settings.email}
              />
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-start gap-3">
                <Icon name="Info" className="text-blue-600 mt-1" size={20} />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 mb-1">Рекомендация</p>
                  <p className="text-blue-700">
                    Включите двухфакторную аутентификацию для повышения безопасности вашего аккаунта
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;