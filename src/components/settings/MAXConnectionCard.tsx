import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface MAXCredentials {
  instance_id: string;
  token: string;
  max_phone?: string;
  max_connected?: boolean;
  max_connected_at?: string;
}

export function MAXConnectionCard() {
  console.log('[MAX] MAXConnectionCard component mounted');
  
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [credentials, setCredentials] = useState<MAXCredentials>({
    instance_id: '',
    token: ''
  });
  const [isConnected, setIsConnected] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    console.log('[MAX] useEffect triggered - calling checkConnection');
    checkConnection();
  }, []);

  const checkConnection = async () => {
    console.log('[MAX] checkConnection started');
    setChecking(true);
    try {
      const userId = localStorage.getItem('userId');
      console.log('[MAX] userId from localStorage:', userId);
      
      const url = 'https://functions.poehali.dev/a24d49e3-71e5-42a1-8eb7-ef651778ea7e';
      console.log('[MAX] Fetching from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || ''
        }
      });

      console.log('[MAX] checkConnection response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[MAX] checkConnection data:', data);
        const user = data.user || {};
        
        setIsConnected(user.max_connected || false);
        console.log('[MAX] isConnected set to:', user.max_connected || false);
        
        if (user.max_connected) {
          setCredentials({
            instance_id: user.green_api_instance_id || '',
            token: user.green_api_token_masked || '',
            max_phone: user.max_phone,
            max_connected: true,
            max_connected_at: user.max_connected_at
          });
        }
      } else {
        console.error('[MAX] checkConnection failed:', response.status);
      }
    } catch (error) {
      console.error('[MAX] checkConnection error:', error);
    } finally {
      setChecking(false);
      console.log('[MAX] checkConnection finished');
    }
  };

  const handleConnect = async () => {
    console.log('[MAX] handleConnect called', credentials);
    
    if (!credentials.instance_id || !credentials.token) {
      console.log('[MAX] Validation failed - missing fields');
      toast({
        title: 'Ошибка',
        description: 'Заполните все поля',
        variant: 'destructive'
      });
      return;
    }

    console.log('[MAX] Starting connection...');
    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      console.log('[MAX] userId from localStorage:', userId);
      
      const url = 'https://functions.poehali.dev/a24d49e3-71e5-42a1-8eb7-ef651778ea7e';
      const payload = {
        instance_id: credentials.instance_id,
        token: credentials.token
      };
      
      console.log('[MAX] Sending request to:', url);
      console.log('[MAX] Payload:', { instance_id: credentials.instance_id, token: '***' });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || ''
        },
        body: JSON.stringify(payload)
      });

      console.log('[MAX] Response status:', response.status);
      const data = await response.json();
      console.log('[MAX] Response data:', data);

      if (response.ok && data.success) {
        console.log('[MAX] Connection successful!');
        toast({
          title: 'Успешно!',
          description: 'MAX мессенджер подключён',
        });
        setIsConnected(true);
        setShowForm(false);
        checkConnection();
      } else {
        console.log('[MAX] Connection failed:', data);
        toast({
          title: 'Ошибка подключения',
          description: data.error || data.details || 'Проверьте правильность данных',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('[MAX] Exception:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось подключиться к серверу',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      console.log('[MAX] handleConnect finished');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Вы уверены что хотите отключить MAX?')) return;

    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch('https://functions.poehali.dev/a24d49e3-71e5-42a1-8eb7-ef651778ea7e', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || ''
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Отключено',
          description: 'MAX мессенджер отключён',
        });
        setIsConnected(false);
        setCredentials({ instance_id: '', token: '' });
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось отключить MAX',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось подключиться к серверу',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="MessageCircle" size={24} />
            MAX Мессенджер
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" className="animate-spin" size={24} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="MessageCircle" size={24} />
          MAX Мессенджер
        </CardTitle>
        <CardDescription>
          Подключите свой личный MAX аккаунт для общения с клиентами
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <Alert className="bg-green-50 border-green-200">
              <Icon name="CheckCircle2" className="text-green-600" size={18} />
              <AlertDescription className="ml-2">
                <div className="font-medium text-green-900">MAX подключён</div>
                <div className="text-sm text-green-700 mt-1">
                  {credentials.max_phone && (
                    <div>Номер: {credentials.max_phone}</div>
                  )}
                  {credentials.max_connected_at && (
                    <div className="text-xs mt-1">
                      Подключено: {new Date(credentials.max_connected_at).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowForm(!showForm)}
              >
                <Icon name="Settings" size={16} className="mr-2" />
                Изменить credentials
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={loading}
              >
                <Icon name="Unplug" size={16} className="mr-2" />
                Отключить
              </Button>
            </div>

            {showForm && (
              <div className="border-t pt-4 space-y-4">
                <Alert>
                  <Icon name="Info" size={18} />
                  <AlertDescription className="ml-2">
                    Обновите credentials если изменили токен в GREEN-API
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div>
                    <Label>Instance ID</Label>
                    <Input
                      placeholder="1234567890"
                      value={credentials.instance_id}
                      onChange={(e) => setCredentials({...credentials, instance_id: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>API Token</Label>
                    <Input
                      type="password"
                      placeholder="Введите новый token"
                      value={credentials.token}
                      onChange={(e) => setCredentials({...credentials, token: e.target.value})}
                    />
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading && <Icon name="Loader2" className="animate-spin mr-2" size={16} />}
                    Обновить credentials
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <Alert>
              <Icon name="Info" size={18} />
              <AlertDescription className="ml-2">
                <div className="font-medium">Как подключить MAX?</div>
                <ol className="text-sm mt-2 space-y-1 list-decimal list-inside">
                  <li>Зарегистрируйтесь на <a href="https://green-api.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">green-api.com</a></li>
                  <li>Создайте инстанс и свяжите свой MAX номер</li>
                  <li>Скопируйте Instance ID и API Token</li>
                  <li>Вставьте их в форму ниже</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div>
                <Label htmlFor="instance_id">Instance ID</Label>
                <Input
                  id="instance_id"
                  placeholder="1234567890"
                  value={credentials.instance_id}
                  onChange={(e) => setCredentials({...credentials, instance_id: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Найдите в личном кабинете GREEN-API
                </p>
              </div>
              <div>
                <Label htmlFor="token">API Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Вставьте token из GREEN-API"
                  value={credentials.token}
                  onChange={(e) => setCredentials({...credentials, token: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Токен для доступа к API
                </p>
              </div>
              <Button
                onClick={handleConnect}
                disabled={loading || !credentials.instance_id || !credentials.token}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Icon name="Loader2" className="animate-spin mr-2" size={16} />
                    Проверка подключения...
                  </>
                ) : (
                  <>
                    <Icon name="Plug" size={16} className="mr-2" />
                    Подключить MAX
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}