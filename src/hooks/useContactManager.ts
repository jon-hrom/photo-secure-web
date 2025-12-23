import { useState } from 'react';
import { toast } from 'sonner';
import { formatPhoneNumber as formatPhone, validatePhone } from '@/utils/phoneFormat';
import type { UserSettings } from './useSettingsData';

const SETTINGS_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';

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

  const initializeContactData = (s: UserSettings) => {
    setEditedEmail(s.email || '');
    setEditedPhone(s.phone || '');
    setEditedDisplayName(s.display_name || '');
    setPhoneVerified(!!s.phone);
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
    phoneVerified,
    setPhoneVerified,
    editedDisplayName,
    setEditedDisplayName,
    isEditingDisplayName,
    setIsEditingDisplayName,
    isSavingDisplayName,
    initializeContactData,
    handleUpdateContact
  };
};
