import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { SnowSettings } from '@/components/settings/NewYearSettings';
import type { UserSettings } from './useSettingsData';

export const useNewYearManager = (getUserId: () => number | null) => {
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

  useEffect(() => {
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

  const initializeNewYearSettings = (s: UserSettings) => {
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
  };

  const handleNewYearSettingsChange = (newSettings: SnowSettings) => {
    setNewYearSettings(newSettings);
    localStorage.setItem('newYearSettings', JSON.stringify(newSettings));
    window.dispatchEvent(new Event('newYearSettingsChange'));
    
    if (newSettings.enabled) {
      localStorage.setItem('newYearMode', 'true');
    } else {
      localStorage.removeItem('newYearMode');
    }
  };

  const saveNewYearSettings = async () => {
    const userId = getUserId();
    
    if (!userId) {
      toast.error('Требуется авторизация');
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-new-year',
          userId,
          enabled: newYearSettings.enabled,
          snowflakes: newYearSettings.snowflakes,
          music: newYearSettings.music
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('[NEW_YEAR] Settings saved successfully:', data);
        toast.success('Новогодние настройки сохранены');
      } else {
        console.error('[NEW_YEAR] Save error:', data);
        toast.error(data.error || 'Ошибка сохранения новогодних настроек');
      }
    } catch (error) {
      console.error('[NEW_YEAR] Save exception:', error);
      toast.error('Ошибка подключения к серверу');
    }
  };

  return {
    newYearSettings,
    setNewYearSettings,
    newYearModeAvailable,
    initializeNewYearSettings,
    handleNewYearSettingsChange,
    saveNewYearSettings
  };
};
