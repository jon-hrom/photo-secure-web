import { useState, useEffect, useRef } from 'react';
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
  clientName?: string;
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
  onDeleteMessage,
  clientName = 'Клиент'
}: ClientDetailMessagesProps) => {
  const [showForm, setShowForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAdd = () => {
    onAddMessage();
    setShowForm(false);
  };

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-2xl">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Icon name="MessageSquare" size={48} className="mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">История переписки пуста</p>
              <p className="text-sm text-muted-foreground mt-1">
                Начните переписку с клиентом
              </p>
            </div>
          </div>
        ) : (
          sortedMessages.map((message) => {
            const isClient = message.author.toLowerCase() === 'клиент' || message.author.toLowerCase() === clientName.toLowerCase();
            
            return (
              <div 
                key={message.id} 
                className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isClient ? 'justify-start' : 'justify-end'}`}
              >
                {isClient && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                    {clientName.charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div className={`flex flex-col max-w-[70%] ${isClient ? 'items-start' : 'items-end'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-semibold text-gray-700">
                      {isClient ? clientName : message.author}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.date).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  <div className={`group relative rounded-2xl p-4 shadow-md ${
                    isClient 
                      ? 'bg-white border-2 border-blue-200 rounded-tl-none' 
                      : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-tr-none'
                  }`}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        isClient ? 'bg-blue-100' : 'bg-white/20'
                      }`}>
                        <Icon 
                          name={messageTypeIcons[message.type]} 
                          size={12} 
                          className={isClient ? 'text-blue-600' : 'text-white'} 
                        />
                      </div>
                      <span className={`text-xs font-medium ${isClient ? 'text-blue-700' : 'text-white/90'}`}>
                        {messageTypeLabels[message.type]}
                      </span>
                      {onDeleteMessage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteMessage(message.id)}
                          className={`ml-auto h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                            isClient ? 'hover:bg-red-50' : 'hover:bg-white/20'
                          }`}
                        >
                          <Icon name="Trash2" size={14} className={isClient ? 'text-red-500' : 'text-white'} />
                        </Button>
                      )}
                    </div>
                    <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
                      isClient ? 'text-gray-800' : 'text-white'
                    }`}>
                      {message.content}
                    </p>
                  </div>
                </div>

                {!isClient && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold shadow-lg">
                    {message.author.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t-2 border-gray-200 rounded-b-2xl shadow-lg">
        {showForm ? (
          <Card className="p-4 space-y-3 border-2 border-primary/20">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold text-sm">Новое сообщение</h4>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowForm(false)}
                className="h-8 w-8 p-0"
              >
                <Icon name="X" size={16} />
              </Button>
            </div>
            
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
                  placeholder="Ваше имя или 'Клиент'"
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
              Отправить
            </Button>
          </Card>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Напишите сообщение..."
              value={newMessage.content}
              onChange={(e) => onMessageChange('content', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && newMessage.content.trim()) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="flex-1 rounded-full border-2 border-gray-300 focus:border-primary"
            />
            <Button 
              onClick={() => setShowForm(true)}
              variant="outline"
              size="icon"
              className="rounded-full flex-shrink-0"
            >
              <Icon name="Plus" size={20} />
            </Button>
            <Button 
              onClick={handleAdd}
              disabled={!newMessage.content.trim()}
              className="rounded-full px-6"
            >
              <Icon name="Send" size={18} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDetailMessages;