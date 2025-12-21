import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useEffect, useState } from 'react';
import MobileNavigation from '@/components/layout/MobileNavigation';
import { toast } from 'sonner';
import funcUrls from '../../../backend/func2url.json';

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
}

const Settings = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [interests, setInterests] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [smsNotifications, setSmsNotifications] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const maxBlocks = document.querySelectorAll('[data-max-connection-card], .max-connection-card, section:has(h2:contains("MAX"))');
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
    loadSettings();
  }, []);

  const getUserId = (): number | null => {
    // Проверяем все источники авторизации
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

      if (data.success && data.settings) {
        const s = data.settings;
        setSettings(s);
        setDisplayName(s.display_name || '');
        setPhone(s.phone || '');
        setFullName(s.full_name || '');
        setBio(s.bio || '');
        setLocation(s.location || '');
        setInterests(s.interests || '');
        setEmailNotifications(s.two_factor_email || false);
        setSmsNotifications(s.two_factor_sms || false);
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
          display_name: displayName,
          phone: phone,
          full_name: fullName,
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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
        </div>
        <MobileNavigation />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 pb-32 md:pb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Настройки</h1>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Профиль</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    value={settings?.email || ''}
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {settings?.email_verified_at ? '✓ Подтверждён' : 'Не подтверждён'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Отображаемое имя</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Как вас называть?"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Полное имя</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Имя Фамилия"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Телефон</label>
                  <input 
                    type="tel" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="+7 (___) ___-__-__"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  {settings?.phone_verified_at && (
                    <p className="text-xs text-green-600 mt-1">✓ Подтверждён</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">О себе</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows={3}
                    placeholder="Расскажите о себе..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Местоположение</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Город, страна"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Интересы</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Фотография, путешествия, дизайн..."
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Уведомления</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-primary rounded"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                  />
                  <span className="text-gray-700">Уведомления по email</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-primary rounded"
                    checked={smsNotifications}
                    onChange={(e) => setSmsNotifications(e.target.checked)}
                  />
                  <span className="text-gray-700">SMS уведомления</span>
                </label>
              </div>
            </section>

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
