import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { formatLocalDate } from '@/utils/dateFormat';

interface AdminMessage {
  id: number;
  message_type: string;
  message_text: string;
  priority: string;
  is_read: boolean;
  created_at: string;
}

const AdminNotifications = () => {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMessages = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?action=get-admin-messages');
      const data = await response.json();
      
      if (data.ok) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: number) => {
    try {
      const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-message-read',
          messageId
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, is_read: true } : msg
        ));
      }
    } catch (error) {
      toast.error('Ошибка');
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 60000); // Обновлять каждую минуту
    return () => clearInterval(interval);
  }, []);

  const unreadMessages = messages.filter(m => !m.is_read);

  if (loading) return null;

  if (unreadMessages.length === 0) return null;

  return (
    <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-300">
          <Icon name="Bell" className="h-5 w-5" />
          Уведомления ({unreadMessages.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {unreadMessages.map((msg) => (
          <div
            key={msg.id}
            className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800"
          >
            <Icon 
              name={msg.priority === 'high' ? 'AlertCircle' : 'Info'} 
              className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                msg.priority === 'high' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{msg.message_text}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatLocalDate(msg.created_at, 'short')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAsRead(msg.id)}
              className="flex-shrink-0"
            >
              <Icon name="Check" className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AdminNotifications;