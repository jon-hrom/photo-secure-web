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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

console.log('[SETTINGS_PAGE] Using API endpoints:', { USER_SETTINGS_API, SETTINGS_API });

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
  const [isSavingLocation, setIsSavingLocation] = useState(false);
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
    } else if (field === 'country' || field === 'region' || field === 'city') {
      setIsSavingLocation(true);
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
        } else if (field === 'region') {
          toast.success('Область сохранена');
          return;
        } else if (field === 'city') {
          toast.success('Город сохранён');
          return;
        } else if (field === 'country') {
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
      } else if (field === 'country' || field === 'region' || field === 'city') {
        setIsSavingLocation(false);
      }
    }
  };

  const handleUpdateLocation = async (country: string, region: string, city: string) => {
    setIsSavingLocation(true);
    try {
      const response = await fetch(USER_SETTINGS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({ country, region, city }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSettings((prev) => ({ ...prev, country, region, city }));
        toast.success('Местоположение сохранено');
      } else {
        toast.error(data.error || 'Ошибка обновления');
      }
    } catch {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setIsSavingLocation(false);
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

        <Accordion type="multiple" className="space-y-3 will-change-transform">
          <AccordionItem value="profile" className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-0">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon name="User" size={20} className="text-primary" />
                <span className="text-lg font-semibold">Профиль и контакты</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-4">
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
                handleUpdateLocation={handleUpdateLocation}
                isSavingLocation={isSavingLocation}
                loadSettings={loadSettings}
                setShowEmailVerification={setShowEmailVerification}
                setShowPhoneVerification={setShowPhoneVerification}
                editedDisplayName={editedDisplayName}
                isEditingDisplayName={isEditingDisplayName}
                setEditedDisplayName={setEditedDisplayName}
                setIsEditingDisplayName={setIsEditingDisplayName}
                isSavingDisplayName={isSavingDisplayName}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="security" className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-0">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon name="Shield" size={20} className="text-primary" />
                <span className="text-lg font-semibold">Безопасность</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-4">
              <SecurityCard
                settings={settings}
                handleToggle2FA={handleToggle2FA}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="appearance" className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-0">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon name="Palette" size={20} className="text-primary" />
                <span className="text-lg font-semibold">Оформление</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-4">
              <Card className="shadow-none border-0">
                <CardContent className="p-0">
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
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="hints" className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-0">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon name="Lightbulb" size={20} className="text-primary" />
                <span className="text-lg font-semibold">Подсказки</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-4">
              <HintsCard />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="help" className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-0">
            <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon name="BookOpen" size={20} className="text-primary" />
                <span className="text-lg font-semibold">Справочный центр</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-6 pb-4">
              <Card className="shadow-none border-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Полное руководство по работе с приложением, ответы на частые вопросы и инструкции с примерами
                  </p>
                  <Button
                    onClick={() => window.location.href = '/#help'}
                    className="w-full sm:w-auto"
                    size="sm"
                  >
                    <Icon name="ExternalLink" size={16} className="mr-2" />
                    Открыть справку
                  </Button>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default SettingsPage;