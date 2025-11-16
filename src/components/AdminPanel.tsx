import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import AdminPanelHeader from '@/components/admin/AdminPanelHeader';
import AdminPanelHistory from '@/components/admin/AdminPanelHistory';
import AdminPanelTabs from '@/components/admin/AdminPanelTabs';

const AdminPanel = () => {
  const [settings, setSettings] = useState({
    twoFactorEnabled: true,
    registrationEnabled: true,
    maintenanceMode: false,
    emailNotifications: true,
    smsNotifications: true,
    autoBackup: true,
    guestAccess: false,
    apiAccess: true,
    darkMode: false,
    analyticsEnabled: true,
    chatSupport: true,
    fileUploadEnabled: true,
    maxFileSize: '10',
    sessionTimeout: '7',
    maxLoginAttempts: '5',
    passwordMinLength: '8',
  });

  const [authProviders, setAuthProviders] = useState({
    yandex: true,
    vk: true,
    google: true,
  });

  const [colors, setColors] = useState({
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    background: '#ffffff',
    text: '#1f2937',
  });

  const [widgets, setWidgets] = useState([
    { id: 1, name: 'Статистика пользователей', enabled: true, order: 1 },
    { id: 2, name: 'Активность сайта', enabled: true, order: 2 },
    { id: 3, name: 'Последние заказы', enabled: true, order: 3 },
    { id: 4, name: 'Уведомления', enabled: false, order: 4 },
    { id: 5, name: 'Аналитика посещений', enabled: true, order: 5 },
  ]);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
    loadHistory();
    loadUsers();
    
    const usersInterval = setInterval(() => {
      loadUsers();
    }, 30000);
    
    return () => clearInterval(usersInterval);
  }, []);

  const loadSettings = async () => {
    try {
      const [oldSettingsResponse, appSettingsResponse, authProvidersResponse] = await Promise.all([
        fetch('https://functions.poehali.dev/68eb5b20-e2c3-4741-aa83-500a5301ff4a'),
        fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0'),
        fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=auth_providers')
      ]);
      
      const oldData = await oldSettingsResponse.json();
      const appSettings = await appSettingsResponse.json();
      const authProvidersData = await authProvidersResponse.json();
      
      if (authProvidersData.value) {
        setAuthProviders(authProvidersData.value);
      }
      
      if (oldData.settings) {
        setSettings(prev => ({
          ...prev,
          ...oldData.settings,
          registrationEnabled: appSettings.registration_enabled ?? prev.registrationEnabled,
          maintenanceMode: appSettings.maintenance_mode ?? prev.maintenanceMode,
          guestAccess: appSettings.guest_access ?? prev.guestAccess,
          maxFileSize: String(oldData.settings.maxFileSize || 10),
          sessionTimeout: String(oldData.settings.sessionTimeout || 7),
          maxLoginAttempts: String(oldData.settings.maxLoginAttempts || 5),
          passwordMinLength: String(oldData.settings.passwordMinLength || 8),
        }));
      } else {
        setSettings(prev => ({
          ...prev,
          registrationEnabled: appSettings.registration_enabled ?? prev.registrationEnabled,
          maintenanceMode: appSettings.maintenance_mode ?? prev.maintenanceMode,
          guestAccess: appSettings.guest_access ?? prev.guestAccess,
        }));
      }
      
      if (oldData.colors) {
        setColors(oldData.colors);
      }
      
      if (oldData.widgets) {
        const mappedWidgets = oldData.widgets.map((w: any, idx: number) => ({
          id: idx + 1,
          name: w.widget_name,
          enabled: w.enabled,
          order: w.display_order,
        }));
        setWidgets(mappedWidgets);
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
      toast.error('Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/ceedefc9-0cb9-4dbc-87aa-4865e7011d43');
      const data = await response.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a');
      const data = await response.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/68eb5b20-e2c3-4741-aa83-500a5301ff4a', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'jonhrom2012@gmail.com',
        },
        body: JSON.stringify({
          settings: {
            ...settings,
            maxFileSize: parseInt(settings.maxFileSize),
            sessionTimeout: parseInt(settings.sessionTimeout),
            maxLoginAttempts: parseInt(settings.maxLoginAttempts),
            passwordMinLength: parseInt(settings.passwordMinLength),
          },
          colors,
          widgets: widgets.map(w => ({
            widget_name: w.name,
            enabled: w.enabled,
            display_order: w.order,
            config_data: {},
          })),
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Все настройки сохранены в базе данных');
        loadHistory();
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      toast.error('Не удалось сохранить настройки');
    }
  };

  const rollbackToVersion = async (historyId: number) => {
    try {
      const response = await fetch('https://functions.poehali.dev/ceedefc9-0cb9-4dbc-87aa-4865e7011d43', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'jonhrom2012@gmail.com',
        },
        body: JSON.stringify({ historyId }),
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Откат выполнен успешно');
        await loadSettings();
        await loadHistory();
      }
    } catch (error) {
      console.error('Ошибка отката:', error);
      toast.error('Не удалось выполнить откат');
    }
  };

  const handleToggle = async (key: string) => {
    const newValue = !settings[key as keyof typeof settings];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    if (key === 'registrationEnabled' || key === 'maintenanceMode' || key === 'guestAccess') {
      const settingKeyMap: Record<string, string> = {
        registrationEnabled: 'registration_enabled',
        maintenanceMode: 'maintenance_mode',
        guestAccess: 'guest_access',
      };
      
      try {
        await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: settingKeyMap[key],
            value: newValue
          })
        });
        toast.success('Настройка обновлена');
      } catch (error) {
        console.error('Ошибка сохранения настройки:', error);
        toast.error('Не удалось сохранить настройку');
        setSettings(prev => ({ ...prev, [key]: !newValue }));
        return;
      }
    } else {
      toast.success('Настройка обновлена');
      setTimeout(saveSettings, 500);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (key: string, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleToggleAuthProvider = async (provider: string) => {
    const newValue = !authProviders[provider as keyof typeof authProviders];
    const updatedProviders = { ...authProviders, [provider]: newValue };
    setAuthProviders(updatedProviders);
    
    try {
      const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'auth_providers',
          value: updatedProviders
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      
      toast.success(`${provider === 'yandex' ? 'Яндекс ID' : provider === 'vk' ? 'VK ID' : 'Google'} ${newValue ? 'включен' : 'отключен'}`);
    } catch (error) {
      console.error('Ошибка сохранения настройки:', error);
      toast.error('Не удалось сохранить настройку');
      setAuthProviders(prev => ({ ...prev, [provider]: !newValue }));
    }
  };

  const handleSaveColors = async () => {
    await saveSettings();
  };

  const moveWidget = async (id: number, direction: 'up' | 'down') => {
    const index = widgets.findIndex(w => w.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === widgets.length - 1)
    ) {
      return;
    }

    const newWidgets = [...widgets];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newWidgets[index], newWidgets[swapIndex]] = [newWidgets[swapIndex], newWidgets[index]];
    
    newWidgets.forEach((widget, idx) => {
      widget.order = idx + 1;
    });

    setWidgets(newWidgets);
    toast.success('Порядок виджетов обновлен');
    setTimeout(saveSettings, 500);
  };

  const toggleWidget = async (id: number) => {
    setWidgets(prev =>
      prev.map(w => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
    toast.success('Статус виджета обновлен');
    setTimeout(saveSettings, 500);
  };

  const deleteUser = async (userId: string | number) => {
    try {
      const response = await fetch('https://functions.poehali.dev/9df9d28d-b7ea-448c-9d93-054c04b6a52b', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Пользователь и все его данные удалены');
        loadUsers();
      } else {
        toast.error(data.error || 'Ошибка удаления');
      }
    } catch (error) {
      console.error('Ошибка удаления пользователя:', error);
      toast.error('Ошибка подключения к серверу');
    }
  };

  const blockUser = async (userId: string | number, reason: string) => {
    try {
      const response = await fetch('https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action: 'block', reason }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Пользователь заблокирован');
        loadUsers();
      } else {
        toast.error('Ошибка блокировки');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  const unblockUser = async (userId: string | number) => {
    try {
      const response = await fetch('https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action: 'unblock' }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Пользователь разблокирован');
        loadUsers();
      } else {
        toast.error('Ошибка разблокировки');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const vkUserData = localStorage.getItem('vk_user');
  const vkUser = vkUserData ? JSON.parse(vkUserData) : null;
  
  const savedSession = localStorage.getItem('authSession');
  const emailUser = savedSession ? JSON.parse(savedSession) : null;

  return (
    <div className="space-y-6">
      <AdminPanelHeader
        vkUser={vkUser}
        emailUser={emailUser}
        showHistory={showHistory}
        onToggleHistory={() => setShowHistory(!showHistory)}
        onSaveSettings={saveSettings}
      />

      <AdminPanelHistory
        history={history}
        showHistory={showHistory}
        onRollback={rollbackToVersion}
      />

      <AdminPanelTabs
        settings={settings}
        authProviders={authProviders}
        colors={colors}
        widgets={widgets}
        users={users}
        onToggle={handleToggle}
        onInputChange={handleInputChange}
        onToggleAuthProvider={handleToggleAuthProvider}
        onColorChange={handleColorChange}
        onSaveColors={handleSaveColors}
        onToggleWidget={toggleWidget}
        onMoveWidget={moveWidget}
        onDeleteUser={deleteUser}
        onBlockUser={blockUser}
        onUnblockUser={unblockUser}
      />
    </div>
  );
};

export default AdminPanel;