import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import MobileNavigation from '@/components/layout/MobileNavigation';
import { toast } from 'sonner';
import funcUrls from '../../../backend/func2url.json';
import SecuritySettings from '@/components/settings/SecuritySettings';
import MultiEmailCard from '@/components/settings/MultiEmailCard';
import NewYearSettings, { SnowSettings } from '@/components/settings/NewYearSettings';
import ProfileSection from '@/components/settings/ProfileSection';
import ThemeSection from '@/components/settings/ThemeSection';
import NotificationsSection from '@/components/settings/NotificationsSection';
import ContactInfoCard from '@/components/settings/ContactInfoCard';
import EmailVerificationDialog from '@/components/EmailVerificationDialog';
import PhoneVerificationDialog from '@/components/PhoneVerificationDialog';
import { formatPhoneNumber as formatPhone, validatePhone } from '@/utils/phoneFormat';

interface UserSettings {
  id: number;
  email: string;
  phone: string | null;
  display_name: string | null;
  full_name: string | null;
  bio: string | null;
  location: string | null;
  interests: string | null;
  two_factor_sms: boolean;
  two_factor_email: boolean;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  source: string | null;
  has_password: string;
}

const Settings = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [interests, setInterests] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [newYearSettings, setNewYearSettings] = useState<SnowSettings>({
    enabled: false,
    speed: 1,
    size: 20,
    direction: 'auto',
    colors: {
      white: 70,
      blue: 15,
      black: 0,
      yellow: 10,
      red: 3,
      green: 2,
    }
  });
  const [newYearModeAvailable, setNewYearModeAvailable] = useState(false);
  
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

  const SETTINGS_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const maxBlocks = document.querySelectorAll('[data-max-connection-card], .max-connection-card');
      maxBlocks.forEach(block => {
        if (block && (block.textContent?.includes('MAX') || block.textContent?.includes('Мессенджер'))) {
          (block as HTMLElement).style.display = 'none';
        }
      });
      
      const allSections = document.querySelectorAll('section');
      allSections.forEach(section => {
        const heading = section.querySelector('h2');
        if (heading?.textContent?.includes('MAX')) {
          (section as HTMLElement).style.display = 'none';
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    console.log('[SETTINGS] Component mounted');
    loadSettings();
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      setTheme('dark');
      applyTheme('dark');
    }
    
    const checkNewYearMode = async () => {
      console.log('[NEW_YEAR] Starting to check new year mode...');
      try {
        const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0');
        console.log('[NEW_YEAR] Response status:', response.status);
        const data = await response.json();
        console.log('[NEW_YEAR] Settings response:', data);
        console.log('[NEW_YEAR] Mode enabled:', data.new_year_mode_enabled);
        console.log('[NEW_YEAR] Setting newYearModeAvailable to:', data.new_year_mode_enabled || false);
        setNewYearModeAvailable(data.new_year_mode_enabled || false);
      } catch (error) {
        console.error('[NEW_YEAR] Failed to check new year mode:', error);
      }
    };
    
    checkNewYearMode();
    
    const savedSnowSettings = localStorage.getItem('newYearSettings');
    if (savedSnowSettings) {
      try {
        setNewYearSettings(JSON.parse(savedSnowSettings));
      } catch (e) {
        console.error('Failed to parse snow settings:', e);
      }
    }
  }, []);

  const getUserId = (): number | null => {
    const vkUser = localStorage.getItem('vk_user');
    const googleUser = localStorage.getItem('google_user');
    const authSession = localStorage.getItem('authSession');

    if (vkUser) {
      try {
        const userData = JSON.parse(vkUser);
        return userData.user_id || null;
      } catch (e) {
        console.error('Failed to parse vk_user:', e);
      }
    }

    if (googleUser) {
      try {
        const userData = JSON.parse(googleUser);
        return userData.user_id || null;
      } catch (e) {
        console.error('Failed to parse google_user:', e);
      }
    }

    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        return session.userId || null;
      } catch (e) {
        console.error('Failed to parse authSession:', e);
      }
    }

    return null;
  };

  const loadSettings = async () => {
    const userId = getUserId();
    
    if (!userId) {
      toast.error('Требуется авторизация');
      setLoading(false);
      return;
    }

    try {
      const settingsUrl = funcUrls['user-settings'];
      const response = await fetch(settingsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        }
      });

      const data = await response.json();
      console.log('[SETTINGS] Full response data:', JSON.stringify(data, null, 2));

      if (data.success && data.settings) {
        const s = data.settings;
        console.log('[SETTINGS] Settings object:', s);
        console.log('[SETTINGS] new_year_mode_available:', s.new_year_mode_available);
        console.log('[SETTINGS] new_year_enabled:', s.new_year_enabled);
        
        setSettings(s);
        setBio(s.bio || '');
        setLocation(s.location || '');
        setInterests(s.interests || '');
        setEmailNotifications(s.two_factor_email || false);
        setSmsNotifications(s.two_factor_sms || false);
        
        setEditedEmail(s.email || '');
        setEditedPhone(s.phone || '');
        setEditedDisplayName(s.display_name || '');
        setPhoneVerified(!!s.phone);
        
        if (s.new_year_enabled !== undefined) {
          console.log('[NEW_YEAR] Loading settings from API:', {
            enabled: s.new_year_enabled,
            snowflakes: s.new_year_snowflakes,
            music: s.new_year_music
          });
          setNewYearSettings({
            enabled: s.new_year_enabled === true || s.new_year_enabled === 'true',
            snowflakes: s.new_year_snowflakes === true || s.new_year_snowflakes === 'true',
            music: s.new_year_music === true || s.new_year_music === 'true'
          });
        }
        
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        if (savedTheme) {
          setTheme(savedTheme);
        }
      } else {
        toast.error(data.error || 'Ошибка загрузки настроек');
      }
    } catch (error) {
      console.error('Load settings error:', error);
      toast.error('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
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
    window.dispatchEvent(new Event('themeChange'));
    toast.success(`Тема изменена на ${newTheme === 'dark' ? 'тёмную' : 'светлую'}`);
  };

  const handleUpdateContact = async (field: 'email' | 'phone' | 'display_name', value: string) => {
    const userId = getUserId();
    if (!userId) {
      toast.error('Требуется авторизация');
      return;
    }

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
      
      const requestBody = { action: 'update-contact', userId, field, value: finalValue };
      console.log('[SETTINGS] Request body:', requestBody);
      
      const response = await fetch(SETTINGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('[SETTINGS] Update response:', { status: response.status, data });

      if (response.ok) {
        if (settings) {
          setSettings({ ...settings, [field]: finalValue });
        }
        if (field === 'phone') {
          setEditedPhone(finalValue);
          toast.success('Телефон сохранен. Теперь подтвердите его.');
          setShowPhoneVerification(true);
          return;
        } else if (field === 'email') {
          setEditedEmail(finalValue);
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

  const handleNewYearSettingsChange = (newSettings: SnowSettings) => {
    setNewYearSettings(newSettings);
    localStorage.setItem('newYearSettings', JSON.stringify(newSettings));
    window.dispatchEvent(new Event('newYearSettingsChange'));
    
    if (newSettings.enabled) {
      localStorage.setItem('newYearMode', 'true');
      window.dispatchEvent(new CustomEvent('newYearModeChange', { detail: true }));
    } else {
      localStorage.setItem('newYearMode', 'false');
      window.dispatchEvent(new CustomEvent('newYearModeChange', { detail: false }));
    }
  };

  const handleSave = async () => {
    const userId = getUserId();
    
    if (!userId) {
      toast.error('Требуется авторизация');
      return;
    }

    setSaving(true);

    try {
      const settingsUrl = funcUrls['user-settings'];
      const response = await fetch(settingsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          bio: bio,
          location: location,
          interests: interests,
          two_factor_email: emailNotifications,
          two_factor_sms: smsNotifications
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Настройки сохранены');
        if (data.settings) {
          setSettings(data.settings);
        }
      } else {
        toast.error(data.error || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
        </div>
        <MobileNavigation />
      </>
    );
  }

  return (
    <>
      {showEmailVerification && (
        <EmailVerificationDialog
          open={showEmailVerification}
          onClose={() => setShowEmailVerification(false)}
          onVerified={async () => {
            setShowEmailVerification(false);
            await loadSettings();
          }}
          userId={settings?.id.toString() || ''}
          userEmail={settings?.email || ''}
          isVerified={!!settings?.email_verified_at}
        />
      )}

      {showPhoneVerification && (
        <PhoneVerificationDialog
          open={showPhoneVerification}
          onClose={() => setShowPhoneVerification(false)}
          onVerified={() => {
            setPhoneVerified(true);
            setShowPhoneVerification(false);
            loadSettings();
          }}
          userId={settings?.id.toString() || ''}
          userPhone={settings?.phone || ''}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 pb-32 md:pb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Настройки</h1>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
            {settings && (
              <ContactInfoCard
                settings={{
                  email: settings.email,
                  phone: settings.phone || '',
                  two_factor_email: settings.two_factor_email,
                  email_verified_at: settings.email_verified_at,
                  source: (settings.source as 'email' | 'vk' | 'google' | 'yandex') || 'email',
                  display_name: settings.display_name || undefined
                }}
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
            )}

            <ProfileSection
              bio={bio}
              setBio={setBio}
              location={location}
              setLocation={setLocation}
              interests={interests}
              setInterests={setInterests}
            />

            <ThemeSection
              theme={theme}
              onThemeChange={handleThemeChange}
            />

            <NotificationsSection
              emailNotifications={emailNotifications}
              setEmailNotifications={setEmailNotifications}
              smsNotifications={smsNotifications}
              setSmsNotifications={setSmsNotifications}
            />

            <MultiEmailCard userId={settings?.id || 0} />

            <SecuritySettings 
              userId={settings?.id || 0}
              hasPassword={settings?.has_password === 'true'}
              userSource={settings?.source}
            />

            {newYearModeAvailable && (
              <NewYearSettings 
                settings={newYearSettings}
                onChange={handleNewYearSettingsChange}
              />
            )}

            <div className="pt-4 border-t">
              <Button 
                className="w-full" 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Сохранение...
                  </>
                ) : (
                  'Сохранить изменения'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <MobileNavigation />
    </>
  );
};

export default Settings;