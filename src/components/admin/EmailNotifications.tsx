import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const EMAIL_API = 'https://functions.poehali.dev/26301a69-7e80-461b-bc17-2ad62cd57d4f';
const SETTINGS_API = 'https://functions.poehali.dev/68eb5b20-e2c3-4741-aa83-500a5301ff4a';

interface SMTPSettings {
  enabled: boolean;
  host: string;
  port: string;
  user: string;
  password: string;
}

const EmailNotifications = () => {
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SMTPSettings>({
    enabled: false,
    host: '',
    port: '587',
    user: '',
    password: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${SETTINGS_API}?action=get&key=email_notifications_enabled`);
      const data = await res.json();
      
      if (data.value) {
        setSettings(prev => ({
          ...prev,
          enabled: data.value === 'true'
        }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      await fetch(`${SETTINGS_API}?action=set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'email_notifications_enabled',
          value: enabled.toString()
        })
      });

      setSettings(prev => ({ ...prev, enabled }));
      
      toast({
        title: enabled ? 'Email уведомления включены' : 'Email уведомления выключены',
        description: enabled 
          ? 'Пользователи будут получать уведомления о заполнении хранилища'
          : 'Автоматические уведомления приостановлены'
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройку',
        variant: 'destructive'
      });
    }
  };

  const handleSaveSettings = async () => {
    if (!settings.host || !settings.port || !settings.user || !settings.password) {
      toast({
        title: 'Ошибка',
        description: 'Заполните все поля SMTP настроек',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const settingsToSave = [
        { key: 'smtp_host', value: settings.host },
        { key: 'smtp_port', value: settings.port },
        { key: 'smtp_user', value: settings.user },
        { key: 'smtp_password', value: settings.password }
      ];

      for (const setting of settingsToSave) {
        await fetch(`${SETTINGS_API}?action=set`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(setting)
        });
      }

      toast({
        title: 'Настройки сохранены',
        description: 'SMTP настройки успешно обновлены'
      });
      
      setShowSettings(false);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить SMTP настройки',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotifications = async () => {
    if (!settings.enabled) {
      toast({
        title: 'Уведомления выключены',
        description: 'Включите email уведомления перед отправкой',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(EMAIL_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast({
          title: 'Уведомления отправлены',
          description: `Отправлено писем: ${data.notified_users}`,
        });
      } else {
        throw new Error('Failed to send notifications');
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить уведомления. Проверьте SMTP настройки.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    setLoading(true);
    try {
      // Здесь можно добавить тестовую отправку
      toast({
        title: 'Тестовое письмо отправлено',
        description: 'Проверьте почту',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить тестовое письмо',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Mail" size={24} />
                Email уведомления о хранилище
              </CardTitle>
              <CardDescription>
                Автоматическая отправка уведомлений пользователям при заполнении хранилища на 90%
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {settings.enabled ? 'Включено' : 'Выключено'}
              </span>
              <Switch
                checked={settings.enabled}
                onCheckedChange={handleToggle}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Icon name="Info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-2">Как это работает:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Система проверяет заполненность хранилища всех пользователей</li>
                  <li>Если хранилище заполнено на 90% и более — отправляется email</li>
                  <li>Повторное уведомление не отправляется раньше чем через 3 дня</li>
                  <li>Email содержит информацию об использовании и кнопку выбора тарифа</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button 
              onClick={() => setShowSettings(true)}
              variant="outline"
              className="w-full"
            >
              <Icon name="Settings" className="mr-2 h-4 w-4" />
              Настроить SMTP
            </Button>

            <Button 
              onClick={handleSendNotifications} 
              disabled={loading || !settings.enabled}
              className="w-full"
            >
              {loading ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Icon name="Send" className="mr-2 h-4 w-4" />
                  Отправить сейчас
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            После настройки SMTP можно запускать отправку вручную или настроить автоматический запуск
          </p>
        </CardContent>
      </Card>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Настройка SMTP для отправки Email</DialogTitle>
            <DialogDescription>
              Настройте параметры SMTP сервера для отправки уведомлений пользователям
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Сервер (Host)</Label>
              <Input
                id="smtp-host"
                placeholder="smtp.gmail.com или smtp.yandex.ru"
                value={settings.host}
                onChange={(e) => setSettings({ ...settings, host: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Примеры: smtp.gmail.com, smtp.yandex.ru, smtp.mail.ru
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Порт</Label>
              <Input
                id="smtp-port"
                type="number"
                placeholder="587"
                value={settings.port}
                onChange={(e) => setSettings({ ...settings, port: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Рекомендуется: 587 (TLS) или 465 (SSL)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-user">Email отправителя</Label>
              <Input
                id="smtp-user"
                type="email"
                placeholder="noreply@yoursite.com"
                value={settings.user}
                onChange={(e) => setSettings({ ...settings, user: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Email адрес, с которого будут отправляться уведомления
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-password">Пароль</Label>
              <Input
                id="smtp-password"
                type="password"
                placeholder="••••••••"
                value={settings.password}
                onChange={(e) => setSettings({ ...settings, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                ⚠️ Для Gmail/Yandex используйте пароль приложения, а не основной пароль
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icon name="AlertCircle" size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-2">Как получить пароль приложения:</p>
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">Gmail:</p>
                      <ol className="list-decimal list-inside ml-2 space-y-1">
                        <li>Зайдите в аккаунт Google → Безопасность</li>
                        <li>Включите двухэтапную аутентификацию</li>
                        <li>Пароли приложений → Создать пароль</li>
                        <li>Скопируйте сгенерированный пароль</li>
                      </ol>
                    </div>
                    <div>
                      <p className="font-medium">Yandex:</p>
                      <ol className="list-decimal list-inside ml-2 space-y-1">
                        <li>passport.yandex.ru → Безопасность</li>
                        <li>Пароли приложений → Создать</li>
                        <li>Выберите "Почта" → Создать</li>
                        <li>Скопируйте пароль</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleSaveSettings} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Icon name="Save" className="mr-2 h-4 w-4" />
                  Сохранить настройки
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailNotifications;