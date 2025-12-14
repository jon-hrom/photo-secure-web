import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Message } from '@/components/clients/ClientsTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClientDetailMessagesProps {
  messages: Message[];
  newMessage: { content: string; type: string; author: string };
  onMessageChange: (field: string, value: string) => void;
  onAddMessage: () => void;
  onDeleteMessage?: (messageId: number) => void;
}

const messageTypeLabels: Record<string, string> = {
  email: 'Email',
  vk: 'ВКонтакте',
  phone: 'Телефон',
  meeting: 'Встреча'
};

const messageTypeIcons: Record<string, string> = {
  email: 'Mail',
  vk: 'MessageCircle',
  phone: 'Phone',
  meeting: 'Calendar'
};

const ClientDetailMessages = ({ 
  messages, 
  newMessage, 
  onMessageChange, 
  onAddMessage,
  onDeleteMessage 
}: ClientDetailMessagesProps) => {
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    onAddMessage();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">История переписки</h3>
        <Button 
          onClick={() => setShowForm(!showForm)} 
          size="sm"
          variant={showForm ? "outline" : "default"}
        >
          <Icon name={showForm ? "X" : "Plus"} size={16} />
          {showForm ? 'Отмена' : 'Добавить'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3 border-2 border-primary/20">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Тип</label>
              <Select 
                value={newMessage.type} 
                onValueChange={(value) => onMessageChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Icon name="Mail" size={16} />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="vk">
                    <div className="flex items-center gap-2">
                      <Icon name="MessageCircle" size={16} />
                      ВКонтакте
                    </div>
                  </SelectItem>
                  <SelectItem value="phone">
                    <div className="flex items-center gap-2">
                      <Icon name="Phone" size={16} />
                      Телефон
                    </div>
                  </SelectItem>
                  <SelectItem value="meeting">
                    <div className="flex items-center gap-2">
                      <Icon name="Calendar" size={16} />
                      Встреча
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Автор</label>
              <Input
                value={newMessage.author}
                onChange={(e) => onMessageChange('author', e.target.value)}
                placeholder="Ваше имя"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Сообщение</label>
            <Textarea
              value={newMessage.content}
              onChange={(e) => onMessageChange('content', e.target.value)}
              placeholder="Текст сообщения..."
              rows={4}
            />
          </div>
          
          <Button onClick={handleAdd} className="w-full">
            <Icon name="Send" size={16} />
            Добавить запись
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        {messages.length === 0 ? (
          <Card className="p-8 text-center">
            <Icon name="MessageSquare" size={48} className="mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">История переписки пуста</p>
            <p className="text-sm text-muted-foreground mt-1">
              Добавьте первую запись переписки с клиентом
            </p>
          </Card>
        ) : (
          messages.map((message) => (
            <Card key={message.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon name={messageTypeIcons[message.type]} size={16} className="text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{message.author}</span>
                      <span className="text-xs text-muted-foreground">
                        {messageTypeLabels[message.type]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(message.date).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                {onDeleteMessage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteMessage(message.id)}
                  >
                    <Icon name="Trash2" size={16} className="text-red-500" />
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap pl-10">{message.content}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ClientDetailMessages;
