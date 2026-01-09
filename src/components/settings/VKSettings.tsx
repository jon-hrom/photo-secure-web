import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const VK_SETTINGS_API = 'https://functions.poehali.dev/f19f02aa-569b-49f2-b9d6-3036bffb9e73';

interface VKSettingsData {
  vk_user_token?: string;
  vk_group_token?: string;
  vk_group_id?: string;
}

const VKSettings = ({ userId }: { userId: string | null }) => {
  const [settings, setSettings] = useState<VKSettingsData>({
    vk_user_token: '',
    vk_group_token: '',
    vk_group_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    const effectiveUserId = userId || localStorage.getItem('userId');
    if (!effectiveUserId) return;

    setLoading(true);
    try {
      const response = await fetch(VK_SETTINGS_API, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': effectiveUserId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading VK settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    const effectiveUserId = userId || localStorage.getItem('userId');
    if (!effectiveUserId) return;

    setSaving(true);
    try {
      const response = await fetch(VK_SETTINGS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': effectiveUserId,
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Настройки ВКонтакте сохранены');
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
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Icon name="MessageCircle" size={24} className="text-blue-600" />
            <CardTitle>Подключение ВКонтакте</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">Загрузка...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Icon name="MessageCircle" size={24} className="text-blue-600" />
          <div>
            <CardTitle>Подключение ВКонтакте</CardTitle>
            <CardDescription>
              Настройте отправку уведомлений клиентам через ВКонтакте
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <Icon name="Info" className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                Как получить токен ВКонтакте:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>Создайте сообщество ВК или используйте личный токен</li>
                <li>
                  Для сообщества: Настройки → Работа с API → Создать ключ → Выберите права "Сообщения
                  сообщества"
                </li>
                <li>
                  Для личного токена:{' '}
                  <a
                    href="https://vkhost.github.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
                  >
                    vkhost.github.io
                  </a>{' '}
                  → Права: messages, offline
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vk-user-token">Токен пользователя (для личных сообщений)</Label>
            <Input
              id="vk-user-token"
              type="password"
              value={settings.vk_user_token || ''}
              onChange={(e) => setSettings({ ...settings, vk_user_token: e.target.value })}
              placeholder="vk1.a.xxxxxxxxxxxxxxxxxxxxx"
            />
            <p className="text-xs text-muted-foreground">
              Используется для отправки сообщений от вашего имени
            </p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-3">Или используйте токен сообщества:</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vk-group-token">Токен сообщества</Label>
                <Input
                  id="vk-group-token"
                  type="password"
                  value={settings.vk_group_token || ''}
                  onChange={(e) => setSettings({ ...settings, vk_group_token: e.target.value })}
                  placeholder="vk1.a.xxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vk-group-id">ID сообщества (необязательно)</Label>
                <Input
                  id="vk-group-id"
                  value={settings.vk_group_id || ''}
                  onChange={(e) => setSettings({ ...settings, vk_group_id: e.target.value })}
                  placeholder="123456789"
                />
                <p className="text-xs text-muted-foreground">
                  Цифровой ID вашего сообщества (можно найти в настройках группы)
                </p>
              </div>
            </div>
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
      </CardContent>
    </Card>
  );
};

export default VKSettings;