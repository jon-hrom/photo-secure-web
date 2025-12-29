import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import EmailVerificationDialog from '@/components/EmailVerificationDialog';
import PhoneVerificationDialog from '@/components/PhoneVerificationDialog';
import ContactInfoCard from '@/components/settings/ContactInfoCard';
import SecurityCard from '@/components/settings/SecurityCard';
import HintsCard from '@/components/settings/HintsCard';

import { formatPhoneNumber as formatPhone, validatePhone } from '@/utils/phoneFormat';

interface UserSettings {
  email: string;
  phone: string;
  two_factor_email: boolean;
  email_verified_at: string | null;
  source?: 'email' | 'vk' | 'google' | 'yandex';
  display_name?: string;
  country?: string;
  region?: string;
  city?: string;
}

interface SettingsPageProps {
  userId: number;
}

const USER_SETTINGS_API = 'https://functions.poehali.dev/8ce3cb93-2701-441d-aa3b-e9c0e99a9994';
const SETTINGS_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';

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
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [editedEmail, setEditedEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedPhone, setEditedPhone] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    loadSettings();
    // Загрузка темы из localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // По умолчанию тёмная тема
      setTheme('dark');
    }
  }, [userId]);

  const loadSettings = async () => {
    console.log('[SETTINGS] Loading settings for userId:', userId);
    try {
      const response = await fetch(USER_SETTINGS_API, {
        headers: { 'X-User-Id': userId.toString() }
      });
      const data = await response.json();
      
      console.log('[SETTINGS] Response:', { status: response.status, data });
      console.log('[SETTINGS] Location data:', { 
        country: data.settings?.country, 
        region: data.settings?.region, 
        city: data.settings?.city 
      });
      
      if (response.ok && data.success) {
        setSettings(data.settings);
        setEditedEmail(data.settings.email || '');
        setEditedPhone(data.settings.phone || '');
        setEditedDisplayName(data.settings.display_name || '');
        setPhoneVerified(!!data.settings.phone);
        
        console.log('[SETTINGS] Settings state updated:', {
          country: data.settings.country,
          region: data.settings.region,
          city: data.settings.city
        });
      } else {
        console.error('[SETTINGS] Load error:', { status: response.status, data });
        toast.error(data.error || 'Ошибка загрузки настроек');
      }
    } catch (error) {
      console.error('[SETTINGS] Load exception:', error);
      toast.error('Ошибка подключения к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  const applyTheme = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // Dispatch event для обновления темы в других компонентах
    window.dispatchEvent(new Event('themeChange'));
    toast.success(`Тема изменена на ${newTheme === 'dark' ? 'тёмную' : 'светлую'}`);
  };

  const handleToggle2FA = async (type: 'email', enabled: boolean) => {
    if (type === 'email' && enabled && !settings.email) {
      toast.error('Добавьте email для включения email-аутентификации');
      return;
    }

    try {
      const response = await fetch(SETTINGS_API, {
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



  const handleUpdateContact = async (field: 'email' | 'phone' | 'display_name' | 'country' | 'region' | 'city', value: string) => {
    console.log('[SETTINGS] Updating contact:', { field, value, userId });
    if (field === 'email') {
      setIsSavingEmail(true);
    } else if (field === 'phone') {
      setIsSavingPhone(true);
    } else if (field === 'display_name') {
      setIsSavingDisplayName(true);
    }
    
    if (field === 'phone' && !validatePhone(value)) {
      toast.error('Телефон должен содержать 11 цифр (включая +7)');
      setIsSavingPhone(false);
      return;
    }
    
    try {
      const finalValue = field === 'phone' ? formatPhone(value) : value;
      
      const requestBody = { [field]: finalValue };
      console.log('[SETTINGS] Request body:', requestBody);
      
      const response = await fetch(USER_SETTINGS_API, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('[SETTINGS] Update response:', { status: response.status, data });

      if (response.ok && data.success) {
        setSettings((prev) => ({ ...prev, [field]: finalValue }));
        if (field === 'phone') {
          setEditedPhone(finalValue);
          toast.success('Телефон сохранен. Теперь подтвердите его.');
          setShowPhoneVerification(true);
          return;
        } else if (field === 'email') {
          setEditedEmail(finalValue);
        } else if (field === 'country' || field === 'region' || field === 'city') {
          return;
        }
        toast.success('Контактные данные обновлены');
      } else {
        console.error('[SETTINGS] Update error:', data);
        toast.error(data.error || 'Ошибка обновления');
      }
    } catch (error) {
      console.error('[SETTINGS] Update exception:', error);
      toast.error('Ошибка подключения к серверу');
    } finally {
      if (field === 'email') {
        setIsSavingEmail(false);
      } else if (field === 'phone') {
        setIsSavingPhone(false);
      } else if (field === 'display_name') {
        setIsSavingDisplayName(false);
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
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 dark:from-primary/5 dark:via-background dark:to-secondary/5 p-3 sm:p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
        <div className="flex items-center gap-2 md:gap-3">
          <Icon name="Settings" size={24} className="text-primary md:w-8 md:h-8" />
          <h1 className="text-2xl md:text-3xl font-bold dark:text-gray-100">Настройки</h1>
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

        {showPhoneVerification && (
          <PhoneVerificationDialog
            open={showPhoneVerification}
            onClose={() => setShowPhoneVerification(false)}
            onVerified={() => {
              setPhoneVerified(true);
              setShowPhoneVerification(false);
            }}
            phone={settings.phone}
          />
        )}

        <ContactInfoCard
          settings={settings}
          editedEmail={editedEmail}
          isEditingEmail={isEditingEmail}
          setEditedEmail={setEditedEmail}
          setIsEditingEmail={setIsEditingEmail}
          isSavingEmail={isSavingEmail}
          editedPhone={editedPhone}
          isEditingPhone={isEditingPhone}
          setEditedPhone={setEditedPhone}
          setIsEditingPhone={setIsEditingPhone}
          setPhoneVerified={setPhoneVerified}
          isSavingPhone={isSavingPhone}
          phoneVerified={phoneVerified}
          handleUpdateContact={handleUpdateContact}
          loadSettings={loadSettings}
          setShowEmailVerification={setShowEmailVerification}
          setShowPhoneVerification={setShowPhoneVerification}
          editedDisplayName={editedDisplayName}
          isEditingDisplayName={isEditingDisplayName}
          setEditedDisplayName={setEditedDisplayName}
          setIsEditingDisplayName={setIsEditingDisplayName}
          isSavingDisplayName={isSavingDisplayName}
        />

        <SecurityCard
          settings={settings}
          handleToggle2FA={handleToggle2FA}
        />

        <Card className="shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-lg shadow-sm">
                <Icon name="Palette" size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">Оформление</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Выберите тему интерфейса
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleThemeChange('light')}
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className="flex-1"
                    size="sm"
                  >
                    <Icon name="Sun" size={16} className="mr-2" />
                    Светлая
                  </Button>
                  <Button
                    onClick={() => handleThemeChange('dark')}
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className="flex-1"
                    size="sm"
                  >
                    <Icon name="Moon" size={16} className="mr-2" />
                    Тёмная
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <HintsCard />

        <Card className="shadow-xl bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <Icon name="BookOpen" size={24} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">Справочный центр</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Полное руководство по работе с приложением, ответы на частые вопросы и инструкции с примерами
                </p>
                <Button
                  onClick={() => window.location.href = '/#help'}
                  className="rounded-full"
                  size="sm"
                >
                  <Icon name="ExternalLink" size={16} className="mr-2" />
                  Открыть справку
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;