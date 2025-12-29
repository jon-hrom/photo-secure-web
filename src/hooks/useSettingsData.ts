import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import funcUrls from '../../backend/func2url.json';

export interface UserSettings {
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
  country?: string;
  region?: string;
  city?: string;
}

export const useSettingsData = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');

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

      if (data.success && data.settings) {
        const s = data.settings;
        setSettings(s);
        setBio(s.bio || '');
        setInterests(s.interests || '');
        
        return s;
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

  const saveSettings = async () => {
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
          interests: interests
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

  return {
    settings,
    setSettings,
    loading,
    saving,
    bio,
    setBio,
    interests,
    setInterests,
    getUserId,
    loadSettings,
    saveSettings
  };
};