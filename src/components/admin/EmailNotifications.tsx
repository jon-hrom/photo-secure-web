import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

const EMAIL_API = 'https://functions.poehali.dev/26301a69-7e80-461b-bc17-2ad62cd57d4f';

const EmailNotifications = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendNotifications = async () => {
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
        <CardTitle className="flex items-center gap-2">
          <Icon name="Mail" size={24} />
          Email уведомления о хранилище
        </CardTitle>
        <CardDescription>
          Автоматическая отправка уведомлений пользователям при заполнении хранилища на 90%
        </CardDescription>
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

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="AlertTriangle" size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-semibold mb-1">Требуется настройка SMTP</p>
              <p>
                Для отправки писем необходимо добавить секреты: SMTP_HOST, SMTP_PORT, 
                SMTP_USER, SMTP_PASSWORD в настройках проекта.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSendNotifications} 
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
              Отправка...
            </>
          ) : (
            <>
              <Icon name="Send" className="mr-2 h-5 w-5" />
              Отправить уведомления сейчас
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Эту функцию можно запускать вручную или настроить автоматический запуск через cron
        </p>
      </CardContent>
    </Card>
  );
};

export default EmailNotifications;
