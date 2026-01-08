import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const BIRTHDAY_API = 'https://functions.poehali.dev/e8f71ffe-1b27-4576-b601-7f01793bd5e2';

interface BirthdaySettings {
  notification_days_before: number;
  greeting_message: string;
  send_to_max: boolean;
  send_to_email: boolean;
  send_to_vk: boolean;
  enabled: boolean;
}

const BirthdayNotificationsCard = ({ userId }: { userId: string | null }) => {
  const [settings, setSettings] = useState<BirthdaySettings>({
    notification_days_before: 10,
    greeting_message: 'Дорогой {name}, поздравляю тебя с Днём Рождения! Желаю здоровья, счастья и ярких моментов! С уважением, твой фотограф.',
    send_to_max: true,
    send_to_email: true,
    send_to_vk: true,
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch(BIRTHDAY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({ action: 'get_settings' }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      toast.error('Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      const response = await fetch(BIRTHDAY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          action: 'update_settings',
          ...settings,
        }),
      });

      if (response.ok) {
        toast.success('Настройки поздравлений сохранены');
      } else {
        toast.error('Не удалось сохранить настройки');
      }
    } catch (error) {
      toast.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6">
        <div className="flex items-center space-x-3">
          <Icon name="Cake" size={24} className="text-primary" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Поздравления с Днём Рождения
          </h2>
        </div>
        <div className="mt-4 text-center text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Icon name="Cake" size={24} className="text-primary" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Поздравления с Днём Рождения
          </h2>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
        />
      </div>

      {settings.enabled && (
        <>
          <div className="space-y-2">
            <Label htmlFor="days-before">За сколько дней напоминать</Label>
            <Input
              id="days-before"
              type="number"
              min="1"
              max="90"
              value={settings.notification_days_before}
              onChange={(e) =>
                setSettings({ ...settings, notification_days_before: parseInt(e.target.value) || 10 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Система будет отправлять поздравления за {settings.notification_days_before} дней до дня рождения
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="greeting-message">Текст поздравления</Label>
            <Textarea
              id="greeting-message"
              value={settings.greeting_message}
              onChange={(e) => setSettings({ ...settings, greeting_message: e.target.value })}
              rows={4}
              placeholder="Используйте {name} для имени клиента"
            />
            <p className="text-xs text-muted-foreground">
              Используйте <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{name}'}</code> для вставки
              имени клиента
            </p>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Каналы отправки</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Icon name="MessageCircle" size={20} className="text-green-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">МАКСу (WhatsApp)</p>
                  <p className="text-sm text-gray-500">Отправка через систему МАКСа</p>
                </div>
              </div>
              <Switch
                checked={settings.send_to_max}
                onCheckedChange={(checked) => setSettings({ ...settings, send_to_max: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Icon name="Mail" size={20} className="text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Email</p>
                  <p className="text-sm text-gray-500">Отправка на электронную почту</p>
                </div>
              </div>
              <Switch
                checked={settings.send_to_email}
                onCheckedChange={(checked) => setSettings({ ...settings, send_to_email: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Icon name="Send" size={20} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">ВКонтакте</p>
                  <p className="text-sm text-gray-500">Отправка в личные сообщения ВК</p>
                </div>
              </div>
              <Switch
                checked={settings.send_to_vk}
                onCheckedChange={(checked) => setSettings({ ...settings, send_to_vk: checked })}
              />
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Icon name="Save" size={20} className="mr-2" />
                Сохранить настройки
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
};

export default BirthdayNotificationsCard;
