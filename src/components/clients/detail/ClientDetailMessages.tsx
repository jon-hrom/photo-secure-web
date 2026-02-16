import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Message } from '@/components/clients/ClientsTypes';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MAX_URL = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';

interface Template {
  template_type: string;
  template_text: string;
  variables: string[];
}

interface ClientDetailMessagesProps {
  messages: Message[];
  newMessage: { content: string; type: string; author: string };
  onMessageChange: (field: string, value: string) => void;
  onAddMessage: () => void;
  onDeleteMessage?: (messageId: number) => void;
  onDeleteAllMessages?: () => void;
  clientName?: string;
  clientId?: number;
  photographerName?: string;
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
  onDeleteAllMessages,
  clientName = 'Клиент',
  clientId,
  photographerName = 'Фотограф'
}: ClientDetailMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sendingViaMax, setSendingViaMax] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    console.log('[ClientDetailMessages] Messages updated:', messages.length);
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(MAX_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId || '1'
          },
          body: JSON.stringify({ action: 'get_templates' })
        });

        const data = await response.json();
        console.log('[ClientDetailMessages] Templates loaded:', data);
        
        if (data.templates) {
          setTemplates(data.templates);
        }
      } catch (error) {
        console.error('[ClientDetailMessages] Error loading templates:', error);
      }
    };

    loadTemplates();
  }, []);

  const handleAdd = () => {
    onAddMessage();
  };

  const handleTemplateSelect = (templateType: string) => {
    setSelectedTemplate(templateType);
    const template = templates.find(t => t.template_type === templateType);
    if (template) {
      let message = template.template_text;
      
      // Подставляем переменные
      message = message.replace(/{client_name}/g, clientName);
      message = message.replace(/{photographer_name}/g, photographerName);
      
      onMessageChange('content', message);
    }
  };

  const handleSendViaMax = async () => {
    console.log('[ClientDetailMessages] handleSendViaMax called', { clientId, messageContent: newMessage.content });
    
    if (!clientId || !newMessage.content.trim()) {
      console.log('[ClientDetailMessages] Validation failed:', { clientId, hasContent: !!newMessage.content.trim() });
      toast.error('Не указан клиент или сообщение пусто');
      return;
    }

    setSendingViaMax(true);
    try {
      const userId = localStorage.getItem('userId');
      console.log('[ClientDetailMessages] Sending request to MAX', { userId, clientId, MAX_URL });
      
      const response = await fetch(MAX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || '1'
        },
        body: JSON.stringify({
          action: 'send_message_to_client',
          client_id: clientId,
          message: newMessage.content
        })
      });

      console.log('[ClientDetailMessages] Response received:', { status: response.status, ok: response.ok });
      const data = await response.json();
      console.log('[ClientDetailMessages] Response data:', data);

      if (data.success) {
        toast.success('Сообщение отправлено через MAX');
        onMessageChange('content', '');
        setSelectedTemplate('');
        window.location.reload();
      } else {
        toast.error(data.error || 'Ошибка отправки');
      }
    } catch (error) {
      console.error('[ClientDetailMessages] Error:', error);
      toast.error('Не удалось отправить сообщение');
    } finally {
      setSendingViaMax(false);
    }
  };

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b">
        <h3 className="text-sm font-semibold text-foreground">История переписки</h3>
        {messages.length > 0 && onDeleteAllMessages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteAllMessages}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Icon name="Trash2" size={16} className="mr-1" />
            Очистить переписку
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-muted/50 to-muted">
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
                    <span className="text-xs font-semibold text-foreground">
                      {isClient ? clientName : (message.author || photographerName)}
                    </span>
                    <span className="text-xs text-muted-foreground">
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
                      ? 'bg-card border-2 border-blue-200 dark:border-blue-800 rounded-tl-none' 
                      : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-tr-none'
                  }`}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        isClient ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-white/20'
                      }`}>
                        <Icon 
                          name={messageTypeIcons[message.type]} 
                          size={12} 
                          className={isClient ? 'text-blue-600 dark:text-blue-400' : 'text-white'} 
                        />
                      </div>
                      <span className={`text-xs font-medium ${isClient ? 'text-blue-700 dark:text-blue-400' : 'text-white/90'}`}>
                        {messageTypeLabels[message.type]}
                      </span>
                      {onDeleteMessage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteMessage(message.id)}
                          className={`ml-auto h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                            isClient ? 'hover:bg-red-50 dark:hover:bg-red-950' : 'hover:bg-white/20'
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
                    {(message.author || photographerName).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 pb-20 bg-background border-t-2 border-border rounded-b-2xl shadow-lg">
        <div className="space-y-2">
          {clientId && templates.length > 0 && (
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите шаблон сообщения..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.template_type} value={template.template_type}>
                    <div className="flex items-center gap-2">
                      <Icon name="FileText" size={14} />
                      <span>{template.template_type}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
              className="flex-1 rounded-full border-2 border-border focus:border-primary"
            />
            <Button 
              onClick={handleAdd}
              disabled={!newMessage.content.trim()}
              className="rounded-full px-6"
              variant="outline"
            >
              <Icon name="Save" size={18} />
            </Button>
          </div>
          
          {clientId && (
            <Button
              onClick={handleSendViaMax}
              disabled={!newMessage.content.trim() || sendingViaMax}
              className="w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {sendingViaMax ? (
                <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
              ) : (
                <>
                  <div className="w-4 h-4 rounded-sm bg-white/20 flex items-center justify-center mr-2">
                    <span className="text-white font-bold text-[10px]">M</span>
                  </div>
                  <span>Отправить через MAX</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDetailMessages;