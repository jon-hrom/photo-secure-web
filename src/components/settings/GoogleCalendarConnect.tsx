import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const CALENDAR_CONNECT_API = 'https://functions.poehali.dev/3d87d4f5-3bb5-4b17-a2c6-45d61cd21992';

export default function GoogleCalendarConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'GOOGLE_CALENDAR_CONNECTED') {
        toast.success('Google Calendar подключен!');
        checkConnection();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkConnection = async () => {
    try {
      setIsLoading(true);
      const userId = localStorage.getItem('userId');
      
      const response = await fetch(CALENDAR_CONNECT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
        setExpiresAt(data.expires_at);
      }
    } catch (error) {
      console.error('Error checking calendar connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectCalendar = async () => {
    try {
      const userId = localStorage.getItem('userId');
      
      const response = await fetch(CALENDAR_CONNECT_API, {
        method: 'GET',
        headers: {
          'X-User-Id': userId || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        const popup = window.open(
          data.auth_url,
          'GoogleCalendarAuth',
          'width=600,height=700,left=100,top=100'
        );

        if (!popup) {
          toast.error('Разрешите всплывающие окна для подключения календаря');
        }
      } else {
        toast.error('Ошибка при получении ссылки OAuth');
      }
    } catch (error) {
      console.error('Error connecting calendar:', error);
      toast.error('Не удалось подключить календарь');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Calendar" size={24} />
            Google Calendar
          </CardTitle>
          <CardDescription>Загрузка...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Calendar" size={24} />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Автоматическая синхронизация съёмок с вашим Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Icon name="CheckCircle2" size={20} />
              <span className="font-medium">Календарь подключен</span>
            </div>
            {expiresAt && (
              <p className="text-sm text-muted-foreground">
                Токен действителен до: {new Date(expiresAt).toLocaleString('ru-RU')}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Когда вы добавляете проект с датой съёмки и включаете опцию
              "Добавить в календарь", событие автоматически создаётся в вашем Google Calendar.
            </p>
            <Button variant="outline" onClick={connectCalendar}>
              <Icon name="RefreshCw" size={16} className="mr-2" />
              Переподключить
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Подключите Google Calendar для автоматической синхронизации всех ваших съёмок.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Автоматическое создание событий при добавлении проектов</li>
              <li>Напоминания за день и за час до съёмки</li>
              <li>Информация о клиенте и адресе в описании события</li>
            </ul>
            <Button onClick={connectCalendar}>
              <Icon name="Calendar" size={16} className="mr-2" />
              Подключить Google Calendar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
