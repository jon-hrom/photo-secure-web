import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { formatLocalDate } from '@/utils/dateFormat';

interface PushNotificationLog {
  id: number;
  userId: number;
  deviceToken: string;
  notificationType: string;
  title: string;
  body: string;
  status: string;
  errorMessage?: string;
  sentAt: string;
  deliveredAt?: string;
  relatedProjectId?: number;
  relatedClientId?: number;
}

interface IOSDevice {
  id: number;
  userId: number;
  deviceToken: string;
  deviceName: string;
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  isActive: boolean;
  lastUsedAt: string;
  createdAt: string;
}

const NotificationMonitor = () => {
  const [pushLogs, setPushLogs] = useState<PushNotificationLog[]>([]);
  const [iosDevices, setIosDevices] = useState<IOSDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
    activeDevices: 0
  });

  const loadPushLogs = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/09fe6ba4-a87d-41a9-a051-643c91e7ab1a?action=get-push-logs&limit=100');
      const data = await response.json();
      
      if (data.logs) {
        setPushLogs(data.logs);
        calculateStats(data.logs);
      }
    } catch (error) {
      console.error('Failed to load push logs:', error);
      toast.error('Не удалось загрузить логи уведомлений');
    }
  };

  const loadIOSDevices = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/09fe6ba4-a87d-41a9-a051-643c91e7ab1a?action=get-all-ios-devices');
      const data = await response.json();
      
      if (data.devices) {
        setIosDevices(data.devices);
        setStats(prev => ({
          ...prev,
          activeDevices: data.devices.filter((d: IOSDevice) => d.isActive).length
        }));
      }
    } catch (error) {
      console.error('Failed to load iOS devices:', error);
      toast.error('Не удалось загрузить список устройств');
    }
  };

  const calculateStats = (logs: PushNotificationLog[]) => {
    const total = logs.length;
    const sent = logs.filter(l => l.status === 'sent').length;
    const delivered = logs.filter(l => l.status === 'delivered').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const pending = logs.filter(l => l.status === 'pending').length;
    
    setStats(prev => ({
      ...prev,
      total,
      sent,
      delivered,
      failed,
      pending
    }));
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadPushLogs(), loadIOSDevices()]);
      setLoading(false);
    };
    
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'shooting_reminder':
        return 'Camera';
      case 'birthday':
        return 'Cake';
      case 'payment':
        return 'CreditCard';
      case 'message':
        return 'MessageCircle';
      default:
        return 'Bell';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Icon name="Loader2" className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Всего отправлено</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
            <p className="text-xs text-muted-foreground">Отправлено</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.delivered}</div>
            <p className="text-xs text-muted-foreground">Доставлено</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Ошибки</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">В очереди</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{stats.activeDevices}</div>
            <p className="text-xs text-muted-foreground">Устройств iOS</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="logs">
            <Icon name="List" className="mr-2 h-4 w-4" />
            История уведомлений
          </TabsTrigger>
          <TabsTrigger value="devices">
            <Icon name="Smartphone" className="mr-2 h-4 w-4" />
            iOS устройства
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Bell" className="h-5 w-5" />
                  Последние уведомления
                </CardTitle>
                <Button variant="outline" size="sm" onClick={loadPushLogs}>
                  <Icon name="RefreshCw" className="h-4 w-4 mr-2" />
                  Обновить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pushLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Уведомлений пока нет
                  </p>
                ) : (
                  pushLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <Icon
                        name={getTypeIcon(log.notificationType)}
                        className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{log.title}</span>
                          <span className={`text-xs font-medium ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{log.body}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>User ID: {log.userId}</span>
                          <span>{formatLocalDate(log.sentAt, 'short')}</span>
                          {log.relatedProjectId && <span>Project #{log.relatedProjectId}</span>}
                        </div>
                        {log.errorMessage && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            Ошибка: {log.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Smartphone" className="h-5 w-5" />
                  Зарегистрированные устройства
                </CardTitle>
                <Button variant="outline" size="sm" onClick={loadIOSDevices}>
                  <Icon name="RefreshCw" className="h-4 w-4 mr-2" />
                  Обновить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {iosDevices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Устройств пока нет
                  </p>
                ) : (
                  iosDevices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-start gap-3 p-3 border rounded-lg"
                    >
                      <Icon
                        name="Smartphone"
                        className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                          device.isActive ? 'text-green-600' : 'text-gray-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {device.deviceName || device.deviceModel}
                          </span>
                          {device.isActive && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                              Активен
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>User ID: {device.userId}</span>
                          <span>{device.deviceModel}</span>
                          <span>iOS {device.osVersion}</span>
                          <span>App v{device.appVersion}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Последняя активность: {formatLocalDate(device.lastUsedAt, 'short')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationMonitor;