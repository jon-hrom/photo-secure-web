import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface Appeal {
  id: number;
  user_identifier: string;
  user_email: string | null;
  user_phone: string | null;
  auth_method: string;
  message: string;
  block_reason: string | null;
  is_blocked: boolean;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  admin_response: string | null;
  responded_at: string | null;
}

interface AdminAppealsNotificationProps {
  userId: number;
  isAdmin: boolean;
}

const AdminAppealsNotification = ({ userId, isAdmin }: AdminAppealsNotificationProps) => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [responseText, setResponseText] = useState('');

  const fetchAppeals = async () => {
    if (!isAdmin) return;

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_appeals',
          admin_user_id: userId
        }),
      });

      const data = await response.json();

      if (response.ok && data.appeals) {
        setAppeals(data.appeals);
        const unread = data.appeals.filter((a: Appeal) => !a.is_read).length;
        setUnreadCount(unread);
        
        if (unread > 0 && !showDialog) {
          setShowDialog(true);
        }
      }
    } catch (error) {
      console.error('Error fetching appeals:', error);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAppeals();
      const interval = setInterval(fetchAppeals, 120000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, userId]);

  const markAsRead = async (appealId: number) => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_appeal_read',
          appeal_id: appealId,
          admin_user_id: userId
        }),
      });

      if (response.ok) {
        toast.success('Обращение отмечено как прочитанное');
        await fetchAppeals();
      }
    } catch (error) {
      console.error('Error marking appeal as read:', error);
      toast.error('Ошибка при обновлении статуса');
    } finally {
      setLoading(false);
    }
  };

  const sendResponse = async (appealId: number) => {
    if (!responseText.trim()) {
      toast.error('Введите текст ответа');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'respond_to_appeal',
          appeal_id: appealId,
          admin_user_id: userId,
          admin_response: responseText.trim()
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Ответ отправлен на email пользователя');
        setResponseText('');
        setRespondingTo(null);
        await fetchAppeals();
      } else {
        toast.error(data.error || 'Ошибка при отправке ответа');
      }
    } catch (error) {
      console.error('Error sending response:', error);
      toast.error('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const getAuthMethodLabel = (method: string) => {
    switch (method) {
      case 'password': return 'Email + пароль';
      case 'vk': return 'ВКонтакте';
      case 'yandex': return 'Яндекс';
      case 'google': return 'Google';
      default: return method;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdmin || appeals.length === 0) return null;

  return (
    <>
      {unreadCount > 0 && (
        <Button
          onClick={() => setShowDialog(true)}
          className="fixed bottom-6 right-6 rounded-full shadow-2xl z-50 h-14 px-6"
          size="lg"
        >
          <Icon name="Bell" size={20} className="mr-2" />
          Обращения ({unreadCount})
          <Badge className="ml-2 bg-red-500 text-white">{unreadCount}</Badge>
        </Button>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Icon name="AlertCircle" size={24} className="text-amber-600" />
              Обращения от заблокированных пользователей
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} новых</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {appeals.map((appeal) => (
                <div
                  key={appeal.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    appeal.is_read 
                      ? 'bg-gray-50 border-gray-200' 
                      : 'bg-amber-50 border-amber-300 shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon 
                          name={appeal.is_blocked ? 'ShieldAlert' : 'CheckCircle'} 
                          size={18} 
                          className={appeal.is_blocked ? 'text-red-600' : 'text-green-600'}
                        />
                        <h3 className="font-semibold text-base">
                          {appeal.user_email || appeal.user_phone || appeal.user_identifier}
                        </h3>
                        {!appeal.is_read && (
                          <Badge variant="destructive" className="text-xs">Новое</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Icon name="Key" size={14} />
                          <span>Метод: {getAuthMethodLabel(appeal.auth_method)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Icon name="Clock" size={14} />
                          <span>{formatDate(appeal.created_at)}</span>
                        </div>
                        {appeal.user_email && (
                          <div className="flex items-center gap-1">
                            <Icon name="Mail" size={14} />
                            <span>{appeal.user_email}</span>
                          </div>
                        )}
                        {appeal.user_phone && (
                          <div className="flex items-center gap-1">
                            <Icon name="Phone" size={14} />
                            <span>{appeal.user_phone}</span>
                          </div>
                        )}
                      </div>

                      {appeal.is_blocked && appeal.block_reason && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-3">
                          <div className="flex items-start gap-2">
                            <Icon name="AlertTriangle" size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-red-900 mb-1">Причина блокировки:</p>
                              <p className="text-sm text-red-700">{appeal.block_reason}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-3 bg-white border border-gray-200 rounded-md mb-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Сообщение пользователя:</p>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{appeal.message}</p>
                      </div>

                      {appeal.admin_response && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="flex items-start gap-2">
                            <Icon name="MessageSquare" size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-blue-900">Ответ администратора:</p>
                                {appeal.responded_at && (
                                  <span className="text-xs text-blue-600">{formatDate(appeal.responded_at)}</span>
                                )}
                              </div>
                              <p className="text-sm text-blue-800 whitespace-pre-wrap">{appeal.admin_response}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {!appeal.is_read && (
                      <Button
                        onClick={() => markAsRead(appeal.id)}
                        disabled={loading}
                        size="sm"
                        variant="outline"
                        className="ml-4 flex-shrink-0"
                      >
                        <Icon name="Check" size={16} className="mr-1" />
                        Прочитано
                      </Button>
                    )}
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs">
                      <Badge variant={appeal.is_blocked ? 'destructive' : 'secondary'}>
                        {appeal.is_blocked ? 'Заблокирован' : 'Активен'}
                      </Badge>
                      {appeal.is_read && appeal.read_at && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Icon name="Eye" size={12} />
                          Прочитано: {formatDate(appeal.read_at)}
                        </span>
                      )}
                    </div>

                    {appeal.user_email && !appeal.admin_response && (
                      <Button
                        onClick={() => {
                          setRespondingTo(appeal.id);
                          setResponseText('');
                        }}
                        size="sm"
                        variant="default"
                        disabled={loading}
                      >
                        <Icon name="Reply" size={14} className="mr-1" />
                        Ответить
                      </Button>
                    )}
                  </div>

                  {respondingTo === appeal.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-2">Ваш ответ пользователю</label>
                        <Textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Напишите ответ на обращение пользователя..."
                          className="min-h-[120px] resize-none"
                          disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Ответ будет отправлен на email: {appeal.user_email}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => sendResponse(appeal.id)}
                          disabled={loading || !responseText.trim()}
                          size="sm"
                        >
                          {loading ? (
                            <>
                              <Icon name="Loader2" size={14} className="mr-1 animate-spin" />
                              Отправка...
                            </>
                          ) : (
                            <>
                              <Icon name="Send" size={14} className="mr-1" />
                              Отправить ответ
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            setRespondingTo(null);
                            setResponseText('');
                          }}
                          variant="outline"
                          size="sm"
                          disabled={loading}
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Всего обращений: {appeals.length}
            </p>
            <Button onClick={() => setShowDialog(false)}>
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminAppealsNotification;