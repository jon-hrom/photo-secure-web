import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  MAX_URL,
  CLIENTS_API,
  VK_NOTIFY_URL,
  Template,
  DeliveryStatus,
  ClientDetailMessagesProps,
} from './messages/messagesShared';
import MessagesList from './messages/MessagesList';
import MessageComposer from './messages/MessageComposer';

const ClientDetailMessages = ({ 
  messages, 
  newMessage, 
  onMessageChange, 
  onAddMessage,
  onDeleteMessage,
  onDeleteAllMessages,
  clientName = 'Клиент',
  clientId,
  photographerName = 'Фотограф',
  clientAvatarUrl = null,
}: ClientDetailMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sendingViaMax, setSendingViaMax] = useState(false);
  const [sendingViaVk, setSendingViaVk] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [resendingIds, setResendingIds] = useState<Set<number>>(new Set());
  const [localStatuses, setLocalStatuses] = useState<Record<number, { status: DeliveryStatus; error?: string | null }>>({});

  const handleResendMessage = async (messageId: number) => {
    setResendingIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
    try {
      const userId = localStorage.getItem('userId');
      const res = await fetch(CLIENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ action: 'resend_message', message_id: messageId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Сообщение отправлено повторно');
      } else {
        toast.error(data.delivery_error || data.error || 'Не удалось отправить');
      }
      setLocalStatuses((prev) => ({
        ...prev,
        [messageId]: { status: data.delivery_status || 'failed', error: data.delivery_error },
      }));
    } catch (e) {
      console.error('[Resend] error', e);
      toast.error('Ошибка повторной отправки');
      setLocalStatuses((prev) => ({
        ...prev,
        [messageId]: { status: 'failed', error: 'Ошибка сети' },
      }));
    } finally {
      setResendingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

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
      } else if (data.no_account) {
        toast.error('У этого номера нет аккаунта MAX — сообщение не отправлено');
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

  const handleSendViaVk = async () => {
    if (!clientId || !newMessage.content.trim()) {
      toast.error('Не указан клиент или сообщение пусто');
      return;
    }
    setSendingViaVk(true);
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(VK_NOTIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '1' },
        body: JSON.stringify({ client_id: clientId, message: newMessage.content }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Сообщение отправлено в ВКонтакте');
        onMessageChange('content', '');
        setSelectedTemplate('');
        window.location.reload();
      } else if (data.need_permission) {
        toast.error(data.error, { duration: 8000 });
      } else {
        toast.error(data.error || 'Ошибка отправки');
      }
    } catch (error) {
      console.error('[ClientDetailMessages] VK Error:', error);
      toast.error('Не удалось отправить сообщение в ВК');
    } finally {
      setSendingViaVk(false);
    }
  };

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="flex flex-col h-[500px] bg-background rounded-lg overflow-hidden">
      <MessagesList
        messages={messages}
        sortedMessages={sortedMessages}
        clientName={clientName}
        photographerName={photographerName}
        clientAvatarUrl={clientAvatarUrl}
        onDeleteMessage={onDeleteMessage}
        onDeleteAllMessages={onDeleteAllMessages}
        localStatuses={localStatuses}
        resendingIds={resendingIds}
        onResend={handleResendMessage}
        messagesEndRef={messagesEndRef}
      />

      <MessageComposer
        clientId={clientId}
        templates={templates}
        selectedTemplate={selectedTemplate}
        onTemplateSelect={handleTemplateSelect}
        newMessage={newMessage}
        onMessageChange={onMessageChange}
        onAdd={handleAdd}
        sendingViaMax={sendingViaMax}
        onSendViaMax={handleSendViaMax}
        sendingViaVk={sendingViaVk}
        onSendViaVk={handleSendViaVk}
      />
    </div>
  );
};

export default ClientDetailMessages;
