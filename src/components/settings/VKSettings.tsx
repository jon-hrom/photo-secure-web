import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const VK_SETTINGS_API = 'https://functions.poehali.dev/f19f02aa-569b-49f2-b9d6-3036bffb9e73';

interface VKConnectionStatus {
  connected: boolean;
  vk_user_name?: string;
  vk_user_id?: string;
}

const VKSettings = ({ userId }: { userId: string | null }) => {
  const [status, setStatus] = useState<VKConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkConnection();
  }, [userId]);

  const checkConnection = async () => {
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
        const hasToken = data.vk_user_token && data.vk_user_token.length > 0;
        setStatus({
          connected: hasToken,
          vk_user_name: data.vk_user_name,
          vk_user_id: data.vk_user_id
        });
      }
    } catch (error) {
      console.error('Error checking VK connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    const vkHostUrl = 'https://vkhost.github.io/';
    window.open(vkHostUrl, '_blank', 'width=800,height=600');
    setShowTokenInput(true);
  };

  const handleSaveToken = async () => {
    if (!token.trim()) {
      toast.error('Введите токен');
      return;
    }

    const effectiveUserId = userId || localStorage.getItem('userId');
    if (!effectiveUserId) {
      toast.error('Не удалось определить пользователя');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(VK_SETTINGS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': effectiveUserId,
        },
        body: JSON.stringify({
          vk_user_token: token.trim()
        }),
      });

      if (response.ok) {
        await checkConnection();
        setShowTokenInput(false);
        setToken('');
        toast.success('ВКонтакте подключен!');
      } else {
        toast.error('Не удалось сохранить токен');
      }
    } catch (error) {
      toast.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    const effectiveUserId = userId || localStorage.getItem('userId');
    if (!effectiveUserId) return;

    try {
      const response = await fetch(VK_SETTINGS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': effectiveUserId,
        },
        body: JSON.stringify({
          vk_user_token: ''
        }),
      });

      if (response.ok) {
        setStatus({ connected: false });
        toast.success('ВКонтакте отключен');
      } else {
        toast.error('Не удалось отключить ВКонтакте');
      }
    } catch (error) {
      toast.error('Ошибка при отключении');
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
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size={32} className="animate-spin text-gray-400" />
          </div>
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
              Отправляйте уведомления о съёмках клиентам в ВК одной кнопкой
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.connected ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex gap-3">
                <Icon name="CheckCircle2" className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="space-y-1">
                  <p className="font-semibold text-green-900 dark:text-green-100">
                    ВКонтакте подключен
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Ваши клиенты будут получать уведомления в личные сообщения ВК
                  </p>
                </div>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              onClick={handleDisconnect} 
              className="w-full border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
            >
              <Icon name="Unplug" size={20} className="mr-2" />
              Отключить ВКонтакте
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!showTokenInput ? (
              <>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Icon name="Info" className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="space-y-2 text-sm">
                      <p className="text-blue-900 dark:text-blue-100">
                        Подключите ВКонтакте для автоматической отправки объявлений о съёмках клиентам в личные сообщения.
                      </p>
                      <p className="text-blue-800 dark:text-blue-200">
                        Нажмите кнопку ниже — откроется страница для получения токена доступа.
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleConnect} 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Icon name="MessageCircle" size={20} className="mr-2" />
                  Подключить ВКонтакте
                </Button>
              </>
            ) : (
              <>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Icon name="AlertCircle" className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        Инструкция:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-amber-800 dark:text-amber-200">
                        <li>В открывшемся окне выберите права <strong>messages</strong> и <strong>offline</strong></li>
                        <li>Нажмите «Получить токен»</li>
                        <li>Скопируйте токен и вставьте в поле ниже</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vk-token">Токен ВКонтакте</Label>
                  <Input
                    id="vk-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="vk1.a.xxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveToken} 
                    disabled={saving || !token.trim()}
                    className="flex-1"
                  >
                    {saving ? (
                      <>
                        <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Icon name="Check" size={20} className="mr-2" />
                        Сохранить
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowTokenInput(false);
                      setToken('');
                    }}
                  >
                    <Icon name="X" size={20} />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VKSettings;