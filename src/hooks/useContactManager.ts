import { useState } from 'react';
import { toast } from 'sonner';
import { formatPhoneNumber as formatPhone, validatePhone } from '@/utils/phoneFormat';
import type { UserSettings } from './useSettingsData';

const USER_SETTINGS_API = 'https://functions.poehali.dev/8ce3cb93-2701-441d-aa3b-e9c0e99a9994';

export const useContactManager = (
  settings: UserSettings | null,
  setSettings: (settings: UserSettings) => void,
  getUserId: () => number | null
) => {
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

  const initializeContactData = (s: UserSettings) => {
    setEditedEmail(s.email || '');
    setEditedPhone(s.phone || '');
    setEditedDisplayName(s.display_name || '');
    setPhoneVerified(!!s.phone);
  };

  const handleUpdateContact = async (field: 'email' | 'phone' | 'display_name' | 'country' | 'region' | 'city', value: string) => {
    const userId = getUserId();
    if (!userId) {
      toast.error('Требуется авторизация');
      return;
    }
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
      
      const response = await fetch(USER_SETTINGS_API, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok && data.success) {
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
          toast.success('Email сохранен. Теперь подтвердите его.');
          setShowEmailVerification(true);
          return;
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
        toast.error(data.error || 'Ошибка обновления');
      }
    } catch (error) {
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
    const userId = getUserId();
    if (!userId) {
      toast.error('Требуется авторизация');
      return;
    }
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
        if (settings) {
          setSettings({ ...settings, country, region, city });
        }
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

  return {
    showEmailVerification,
    setShowEmailVerification,
    showPhoneVerification,
    setShowPhoneVerification,
    editedEmail,
    setEditedEmail,
    isEditingEmail,
    setIsEditingEmail,
    editedPhone,
    setEditedPhone,
    isEditingPhone,
    setIsEditingPhone,
    isSavingEmail,
    isSavingPhone,
    isSavingLocation,
    phoneVerified,
    setPhoneVerified,
    editedDisplayName,
    setEditedDisplayName,
    isEditingDisplayName,
    setIsEditingDisplayName,
    isSavingDisplayName,
    initializeContactData,
    handleUpdateContact,
    handleUpdateLocation
  };
};