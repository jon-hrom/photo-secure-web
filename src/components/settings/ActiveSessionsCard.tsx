import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Session {
  session_id: string;
  created_at: string;
  expires_at: string;
  last_activity: string;
  ip_address: string;
  user_agent: string;
  is_current: boolean;
}

interface ActiveSessionsCardProps {
  userId: number;
}

export const ActiveSessionsCard = ({ userId }: ActiveSessionsCardProps) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [revokeAll, setRevokeAll] = useState(false);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem('auth_token');
      
      const response = await fetch(
        `https://functions.poehali.dev/e3e5511e-7caa-42ba-b6dd-a76e44fd0272?action=list&user_id=${userId}`,
        {
          headers: {
            'X-User-Id': userId.toString(),
            'X-Auth-Token': authToken || ''
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      const data = await response.json();
      
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('[SESSIONS] Error loading sessions:', error);
      toast.error('Не удалось загрузить активные сессии');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadSessions();
    }
  }, [userId]);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const authToken = localStorage.getItem('auth_token');
      
      const response = await fetch(
        `https://functions.poehali.dev/e3e5511e-7caa-42ba-b6dd-a76e44fd0272?action=revoke&user_id=${userId}&session_id=${sessionId}`,
        {
          headers: {
            'X-User-Id': userId.toString(),
            'X-Auth-Token': authToken || ''
          }
        }
      );

      const data = await response.json();

      if (data.success && data.revoked) {
        toast.success('Сессия завершена');
        loadSessions();
      } else {
        toast.error('Не удалось завершить сессию');
      }
    } catch (error) {
      console.error('[SESSIONS] Error revoking session:', error);
      toast.error('Ошибка при завершении сессии');
    }

    setShowRevokeDialog(false);
    setSessionToRevoke(null);
  };

  const handleRevokeAll = async () => {
    try {
      const authToken = localStorage.getItem('auth_token');
      
      const response = await fetch(
        `https://functions.poehali.dev/e3e5511e-7caa-42ba-b6dd-a76e44fd0272?action=revoke_other&user_id=${userId}`,
        {
          headers: {
            'X-User-Id': userId.toString(),
            'X-Auth-Token': authToken || ''
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success(`Завершено сессий: ${data.revoked_count}`);
        loadSessions();
      } else {
        toast.error('Не удалось завершить сессии');
      }
    } catch (error) {
      console.error('[SESSIONS] Error revoking sessions:', error);
      toast.error('Ошибка при завершении сессий');
    }

    setShowRevokeDialog(false);
    setRevokeAll(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getBrowserInfo = (userAgent: string) => {
    if (!userAgent) return 'Неизвестный браузер';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Браузер';
  };

  const getDeviceType = (userAgent: string) => {
    if (!userAgent) return 'Desktop';
    
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  };

  const formatLocation = (ipAddress: string) => {
    if (!ipAddress || ipAddress === 'unknown') return 'Неизвестное местоположение';
    
    try {
      const geo = JSON.parse(ipAddress);
      
      // Новый формат 2ip.io API (с lang=ru)
      const city = geo.city || '';
      const country = geo.country || '';
      const countryCode = geo.country_code || geo.code || '';
      const emoji = geo.emoji || '';
      
      // Используем emoji из API или генерируем из country_code
      const flag = emoji || (countryCode ? String.fromCodePoint(...countryCode.toUpperCase().split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0))) : '');
      
      if (city && country) {
        return `${flag} ${city}, ${country}`;
      }
      if (country) {
        return `${flag} ${country}`;
      }
    } catch {
      // Если не JSON, значит это просто IP
    }
    
    return `IP: ${ipAddress}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Активные сессии</CardTitle>
          <CardDescription>Загрузка...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Monitor" size={20} />
                Активные сессии
              </CardTitle>
              <CardDescription>
                Устройства, с которых выполнен вход в ваш аккаунт ({sessions.length})
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRevokeAll(true);
                  setShowRevokeDialog(true);
                }}
              >
                <Icon name="LogOut" size={16} className="mr-2" />
                Завершить другие
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="ShieldCheck" size={48} className="mx-auto mb-4 opacity-50" />
              <p>Нет активных сессий</p>
            </div>
          ) : (
            sessions.map((session, index) => (
              <div key={session.session_id}>
                {index > 0 && <Separator className="my-4" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      <Icon
                        name={getDeviceType(session.user_agent) === 'Mobile' ? 'Smartphone' : 'Monitor'}
                        size={24}
                        className="text-muted-foreground"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {getBrowserInfo(session.user_agent)} на {getDeviceType(session.user_agent)}
                        </p>
                        {session.is_current && (
                          <Badge variant="default" className="text-xs">
                            Текущая
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatLocation(session.ip_address)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Создана: {formatDate(session.created_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Последняя активность: {formatDate(session.last_activity)}
                      </p>
                    </div>
                  </div>
                  {!session.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSessionToRevoke(session.session_id);
                        setRevokeAll(false);
                        setShowRevokeDialog(true);
                      }}
                    >
                      <Icon name="LogOut" size={16} className="mr-2" />
                      Завершить
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {revokeAll ? 'Завершить все другие сессии?' : 'Завершить сессию?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeAll
                ? 'Все другие устройства будут отключены от вашего аккаунта. Вам потребуется войти заново на этих устройствах.'
                : 'Это устройство будет отключено от вашего аккаунта. Потребуется повторный вход.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRevokeDialog(false);
              setSessionToRevoke(null);
              setRevokeAll(false);
            }}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeAll) {
                  handleRevokeAll();
                } else if (sessionToRevoke) {
                  handleRevokeSession(sessionToRevoke);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Завершить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ActiveSessionsCard;