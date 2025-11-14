import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

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

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/68eb5b20-e2c3-4741-aa83-500a5301ff4a');
      const data = await response.json();
      
      if (data.settings) {
        setSettings(prev => ({
          ...prev,
          ...data.settings,
          maxFileSize: String(data.settings.maxFileSize || 10),
          sessionTimeout: String(data.settings.sessionTimeout || 7),
          maxLoginAttempts: String(data.settings.maxLoginAttempts || 5),
          passwordMinLength: String(data.settings.passwordMinLength || 8),
        }));
      }
      
      if (data.colors) {
        setColors(data.colors);
      }
      
      if (data.widgets) {
        const mappedWidgets = data.widgets.map((w: any, idx: number) => ({
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
    setSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
    toast.success('Настройка обновлена');
    setTimeout(saveSettings, 500);
  };

  const handleInputChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (key: string, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
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
    toast.success('Виджет обновлен');
    setTimeout(saveSettings, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon name="Loader2" size={48} className="animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-muted-foreground">Загрузка настроек...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Панель администратора
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Полный контроль над настройками и функциями сайта
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <Button
            onClick={() => setShowHistory(!showHistory)}
            variant={showHistory ? "default" : "outline"}
            className="gap-1 sm:gap-2 flex-1 sm:flex-initial"
            size="sm"
          >
            <Icon name="History" size={18} />
            <span className="hidden sm:inline">История изменений</span>
            <span className="sm:hidden">История</span>
            <span>({history.length})</span>
          </Button>
          <Icon name="ShieldCheck" size={36} className="text-orange-500 hidden sm:block sm:w-12 sm:h-12" />
        </div>
      </div>

      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="History" size={24} />
              История изменений настроек
            </CardTitle>
            <CardDescription>
              Все изменения сохраняются. Вы можете откатиться к любой версии.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                История изменений пока пуста
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-medium text-sm">#{item.id}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Изменено: {item.changedBy}
                      </p>
                    </div>
                    <Button
                      onClick={() => rollbackToVersion(item.id)}
                      variant="outline"
                      size="sm"
                      className="gap-2 w-full sm:w-auto"
                    >
                      <Icon name="RotateCcw" size={16} />
                      Откатить
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
          <TabsTrigger value="general" className="gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
            <Icon name="Settings" size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Общие</span>
            <span className="sm:hidden">Настройки</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
            <Icon name="Lock" size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Безопасность</span>
            <span className="sm:hidden">Безоп.</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
            <Icon name="Palette" size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Внешний вид</span>
            <span className="sm:hidden">Вид</span>
          </TabsTrigger>
          <TabsTrigger value="widgets" className="gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
            <Icon name="LayoutGrid" size={14} className="sm:w-4 sm:h-4" />
            Виджеты
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1 sm:gap-2 py-2 text-xs sm:text-sm col-span-2 sm:col-span-1">
            <Icon name="Users" size={14} className="sm:w-4 sm:h-4" />
            Пользователи
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Основные настройки</CardTitle>
              <CardDescription>Управление основными функциями сайта</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="registration" className="text-sm sm:text-base">Регистрация новых пользователей</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Разрешить регистрацию на сайте
                  </p>
                </div>
                <Switch
                  id="registration"
                  checked={settings.registrationEnabled}
                  onCheckedChange={() => handleToggle('registrationEnabled')}
                />
              </div>
              <Separator />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="maintenance" className="text-sm sm:text-base">Режим обслуживания</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Закрыть сайт для технических работ
                  </p>
                </div>
                <Switch
                  id="maintenance"
                  checked={settings.maintenanceMode}
                  onCheckedChange={() => handleToggle('maintenanceMode')}
                />
              </div>
              <Separator />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="guestAccess" className="text-sm sm:text-base">Гостевой доступ</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Разрешить просмотр без авторизации
                  </p>
                </div>
                <Switch
                  id="guestAccess"
                  checked={settings.guestAccess}
                  onCheckedChange={() => handleToggle('guestAccess')}
                />
              </div>
              <Separator />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="fileUpload" className="text-sm sm:text-base">Загрузка файлов</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Разрешить пользователям загружать файлы
                  </p>
                </div>
                <Switch
                  id="fileUpload"
                  checked={settings.fileUploadEnabled}
                  onCheckedChange={() => handleToggle('fileUploadEnabled')}
                />
              </div>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="maxFileSize" className="text-sm sm:text-base">Максимальный размер файла (МБ)</Label>
                <Input
                  id="maxFileSize"
                  type="number"
                  value={settings.maxFileSize}
                  onChange={(e) => handleInputChange('maxFileSize', e.target.value)}
                  className="w-full sm:max-w-xs"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Уведомления</CardTitle>
              <CardDescription>Настройка системы уведомлений</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailNotif">Email уведомления</Label>
                  <p className="text-sm text-muted-foreground">
                    Отправка уведомлений на почту
                  </p>
                </div>
                <Switch
                  id="emailNotif"
                  checked={settings.emailNotifications}
                  onCheckedChange={() => handleToggle('emailNotifications')}
                />
              </div>
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="smsNotif">SMS уведомления</Label>
                  <p className="text-sm text-muted-foreground">
                    Отправка уведомлений по SMS
                  </p>
                </div>
                <Switch
                  id="smsNotif"
                  checked={settings.smsNotifications}
                  onCheckedChange={() => handleToggle('smsNotifications')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Безопасность</CardTitle>
              <CardDescription>Настройки защиты и аутентификации</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="twoFactor">Двухфакторная аутентификация</Label>
                  <p className="text-sm text-muted-foreground">
                    Требовать код подтверждения при входе
                  </p>
                </div>
                <Switch
                  id="twoFactor"
                  checked={settings.twoFactorEnabled}
                  onCheckedChange={() => handleToggle('twoFactorEnabled')}
                />
              </div>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">Таймаут сессии (минуты)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) => handleInputChange('sessionTimeout', e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Автоматический выход при неактивности
                </p>
              </div>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="maxAttempts">Максимум попыток входа</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  value={settings.maxLoginAttempts}
                  onChange={(e) => handleInputChange('maxLoginAttempts', e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Блокировка после неудачных попыток
                </p>
              </div>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="passwordLength">Минимальная длина пароля</Label>
                <Input
                  id="passwordLength"
                  type="number"
                  value={settings.passwordMinLength}
                  onChange={(e) => handleInputChange('passwordMinLength', e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoBackup">Автоматическое резервное копирование</Label>
                  <p className="text-sm text-muted-foreground">
                    Ежедневный бэкап данных
                  </p>
                </div>
                <Switch
                  id="autoBackup"
                  checked={settings.autoBackup}
                  onCheckedChange={() => handleToggle('autoBackup')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API и интеграции</CardTitle>
              <CardDescription>Управление внешними подключениями</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="apiAccess">API доступ</Label>
                  <p className="text-sm text-muted-foreground">
                    Разрешить API запросы
                  </p>
                </div>
                <Switch
                  id="apiAccess"
                  checked={settings.apiAccess}
                  onCheckedChange={() => handleToggle('apiAccess')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Цветовая схема</CardTitle>
              <CardDescription>Настройка палитры сайта</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="primary">Основной цвет</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary"
                      type="color"
                      value={colors.primary}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={colors.primary}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondary">Вторичный цвет</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary"
                      type="color"
                      value={colors.secondary}
                      onChange={(e) => handleColorChange('secondary', e.target.value)}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={colors.secondary}
                      onChange={(e) => handleColorChange('secondary', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accent">Акцентный цвет</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accent"
                      type="color"
                      value={colors.accent}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={colors.accent}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background">Фон</Label>
                  <div className="flex gap-2">
                    <Input
                      id="background"
                      type="color"
                      value={colors.background}
                      onChange={(e) => handleColorChange('background', e.target.value)}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={colors.background}
                      onChange={(e) => handleColorChange('background', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="text">Текст</Label>
                  <div className="flex gap-2">
                    <Input
                      id="text"
                      type="color"
                      value={colors.text}
                      onChange={(e) => handleColorChange('text', e.target.value)}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={colors.text}
                      onChange={(e) => handleColorChange('text', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveColors} className="w-full">
                <Icon name="Save" size={18} className="mr-2" />
                Сохранить цветовую схему
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Тема интерфейса</CardTitle>
              <CardDescription>Настройка отображения</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="darkMode">Темная тема</Label>
                  <p className="text-sm text-muted-foreground">
                    Переключить на темный режим
                  </p>
                </div>
                <Switch
                  id="darkMode"
                  checked={settings.darkMode}
                  onCheckedChange={() => handleToggle('darkMode')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="widgets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Управление виджетами</CardTitle>
              <CardDescription>Настройка расположения и видимости виджетов на дашборде</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {widgets.map((widget, index) => (
                  <div
                    key={widget.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveWidget(widget.id, 'up')}
                          disabled={index === 0}
                          className="h-6 w-6 p-0"
                        >
                          <Icon name="ChevronUp" size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveWidget(widget.id, 'down')}
                          disabled={index === widgets.length - 1}
                          className="h-6 w-6 p-0"
                        >
                          <Icon name="ChevronDown" size={16} />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                          {widget.order}
                        </div>
                        <div>
                          <p className="font-medium">{widget.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {widget.enabled ? 'Активен' : 'Отключен'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={widget.enabled}
                      onCheckedChange={() => toggleWidget(widget.id)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Управление пользователями</CardTitle>
              <CardDescription>Права доступа и роли пользователей</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="analytics">Аналитика пользователей</Label>
                  <p className="text-sm text-muted-foreground">
                    Отслеживание активности
                  </p>
                </div>
                <Switch
                  id="analytics"
                  checked={settings.analyticsEnabled}
                  onCheckedChange={() => handleToggle('analyticsEnabled')}
                />
              </div>
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="chatSupport">Чат поддержки</Label>
                  <p className="text-sm text-muted-foreground">
                    Онлайн-чат для пользователей
                  </p>
                </div>
                <Switch
                  id="chatSupport"
                  checked={settings.chatSupport}
                  onCheckedChange={() => handleToggle('chatSupport')}
                />
              </div>
              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Роли пользователей</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Администратор</h4>
                      <Icon name="ShieldCheck" size={20} className="text-orange-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">Полный доступ ко всем функциям</p>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Модератор</h4>
                      <Icon name="Shield" size={20} className="text-blue-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">Управление контентом</p>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Пользователь</h4>
                      <Icon name="User" size={20} className="text-green-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">Стандартный доступ</p>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Гость</h4>
                      <Icon name="UserX" size={20} className="text-gray-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">Ограниченный доступ</p>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;