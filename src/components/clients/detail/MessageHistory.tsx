import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Message } from '@/components/clients/ClientsTypes';

interface MessageHistoryProps {
  messages: Message[];
  formatDateTime: (dateString: string) => string;
}

const MessageHistory = ({ messages, formatDateTime }: MessageHistoryProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>История взаимодействий</CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Icon name="History" size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">История пуста</p>
            <p className="text-sm text-muted-foreground mt-1">
              Здесь будет отображаться история общения с клиентом
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    name={
                      msg.type === 'email' ? 'Mail' :
                      msg.type === 'vk' ? 'MessageCircle' :
                      msg.type === 'phone' ? 'Phone' : 'Users'
                    }
                    size={16}
                    className="text-primary"
                  />
                  <span className="text-sm font-medium">{msg.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(msg.date)}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MessageHistory;
