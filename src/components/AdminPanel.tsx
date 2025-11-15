import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import AdminGeneralSettings from '@/components/admin/AdminGeneralSettings';
import AdminAppearance from '@/components/admin/AdminAppearance';
import AdminWidgets from '@/components/admin/AdminWidgets';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminAuthProviders from '@/components/admin/AdminAuthProviders';

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
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?action=list-users');
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

  const deleteUser = async (userId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-user', userId }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Пользователь удален');
        loadUsers();
      } else {
        toast.error(data.error || 'Ошибка удаления');
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

  return (
    <div className="space-y-6">
      {vkUser && (
        <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {vkUser.avatar && (
                <div className="relative">
                  <img 
                    src={vkUser.avatar} 
                    alt={vkUser.name}
                    className="w-16 h-16 rounded-full border-4 border-white shadow-lg"
                  />
                  {vkUser.is_verified && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
                      <Icon name="BadgeCheck" size={16} className="text-blue-500" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold">{vkUser.name || 'Пользователь VK'}</h3>
                  {vkUser.is_verified && (
                    <Icon name="BadgeCheck" size={20} className="text-white" />
                  )}
                  {(vkUser.name && vkUser.name.includes('Пономарев Евгений')) && (
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold border border-white/30">
                      Администратор
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-90">{vkUser.email || 'Вход через VK ID'}</p>
                {vkUser.phone && (
                  <p className="text-xs opacity-75 mt-1">{vkUser.phone}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-xs opacity-75">Роль</div>
                  <div className="font-semibold">Главный администратор</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Панель администратора</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Управление настройками системы</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full sm:w-auto"
          >
            <Icon name="History" size={18} className="mr-2" />
            <span className="sm:inline">История</span>
          </Button>
          <Button onClick={saveSettings} className="w-full sm:w-auto">
            <Icon name="Save" size={18} className="mr-2" />
            Сохранить все
          </Button>
        </div>
      </div>

      {showHistory && history.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">История изменений</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card gap-3"
                >
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">
                      Версия #{item.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.changed_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rollbackToVersion(item.id)}
                    className="w-full sm:w-auto"
                  >
                    <Icon name="RotateCcw" size={16} className="mr-2" />
                    Откатить
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto gap-2">
          <TabsTrigger value="general" className="text-xs sm:text-sm">
            <Icon name="Settings" size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Общие</span>
            <span className="sm:hidden">Общ.</span>
          </TabsTrigger>
          <TabsTrigger value="auth" className="text-xs sm:text-sm">
            <Icon name="Key" size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Способы входа</span>
            <span className="sm:hidden">Вход</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs sm:text-sm">
            <Icon name="Palette" size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Внешний вид</span>
            <span className="sm:hidden">Вид</span>
          </TabsTrigger>
          <TabsTrigger value="widgets" className="text-xs sm:text-sm">
            <Icon name="LayoutGrid" size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Виджеты</span>
            <span className="sm:hidden">Видж.</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm">
            <Icon name="Users" size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Пользователи</span>
            <span className="sm:hidden">Польз.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <AdminGeneralSettings
            settings={settings}
            handleToggle={handleToggle}
            handleInputChange={handleInputChange}
          />
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <AdminAuthProviders
            authProviders={authProviders}
            onToggleProvider={handleToggleAuthProvider}
          />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <AdminAppearance
            colors={colors}
            handleColorChange={handleColorChange}
            handleSaveColors={handleSaveColors}
          />
        </TabsContent>

        <TabsContent value="widgets" className="space-y-4">
          <AdminWidgets
            widgets={widgets}
            moveWidget={moveWidget}
            toggleWidget={toggleWidget}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <AdminUsers
            users={users}
            deleteUser={deleteUser}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;