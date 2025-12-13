import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

const EMAIL_API = 'https://functions.poehali.dev/26301a69-7e80-461b-bc17-2ad62cd57d4f';
const SETTINGS_API = 'https://functions.poehali.dev/68eb5b20-e2c3-4741-aa83-500a5301ff4a';

const EmailNotifications = () => {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${SETTINGS_API}?action=get&key=email_notifications_enabled`);
      const data = await res.json();
      
      if (data.value) {
        setEnabled(data.value === 'true');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleToggle = async (checked: boolean) => {
    try {
      await fetch(`${SETTINGS_API}?action=set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'email_notifications_enabled',
          value: checked.toString()
        })
      });

      setEnabled(checked);
      
      toast({
        title: checked ? 'Email уведомления включены' : 'Email уведомления выключены',
        description: checked 
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

  const handleSendNotifications = async () => {
    if (!enabled) {
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
        description: 'Не удалось отправить уведомления',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
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
              {enabled ? 'Включено' : 'Выключено'}
            </span>
            <Switch
              checked={enabled}
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

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="Mail" size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Почта настроена автоматически</p>
              <p>Все email отправляются через Yandex Cloud Postbox с адреса jon-hrom2012@gmail.com</p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSendNotifications} 
          disabled={loading || !enabled}
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
              Отправить уведомления сейчас
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Можно запускать отправку вручную или настроить автоматический запуск через cron
        </p>
      </CardContent>
    </Card>
  );
};

export default EmailNotifications;
