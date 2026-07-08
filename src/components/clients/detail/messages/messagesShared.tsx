import Icon from '@/components/ui/icon';
import { Message } from '@/components/clients/ClientsTypes';

export const MAX_URL = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';
export const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';
export const VK_NOTIFY_URL = 'https://functions.poehali.dev/9e969787-1b8b-439d-8e29-8031cab6fc89';

export interface Template {
  template_type: string;
  template_text: string;
  variables: string[];
}

export interface ClientDetailMessagesProps {
  messages: Message[];
  newMessage: { content: string; type: string; author: string };
  onMessageChange: (field: string, value: string) => void;
  onAddMessage: () => void;
  onDeleteMessage?: (messageId: number) => void;
  onDeleteAllMessages?: () => void;
  clientName?: string;
  clientId?: number;
  photographerName?: string;
  clientAvatarUrl?: string | null;
}

export const messageTypeLabels: Record<string, string> = {
  email: 'Email',
  vk: 'ВКонтакте',
  phone: 'Телефон',
  meeting: 'Встреча',
  whatsapp: 'WhatsApp/MAX',
  telegram: 'Telegram',
};

export const messageTypeIcons: Record<string, string> = {
  email: 'Mail',
  vk: 'MessageCircle',
  phone: 'Phone',
  meeting: 'Calendar',
  whatsapp: 'MessageCircle',
  telegram: 'Send',
};

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown' | null | undefined;

export const renderDeliveryBadge = (status: DeliveryStatus, error?: string | null) => {
  if (!status) return null;
  if (status === 'read') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-blue-100" title="Клиент прочитал">
        <Icon name="CheckCheck" size={11} />
        <span>Прочитано</span>
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-white/85" title="Доставлено">
        <Icon name="CheckCheck" size={11} />
        <span>Доставлено</span>
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-white/70" title="Отправлено, доставка не подтверждена">
        <Icon name="Check" size={11} />
        <span>Отправлено</span>
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-red-200 bg-red-500/30 px-1.5 py-0.5 rounded"
        title={error || 'Не доставлено'}
      >
        <Icon name="AlertTriangle" size={11} />
        <span>Не доставлено</span>
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-white/70" title="В очереди на отправку">
        <Icon name="Clock" size={11} />
        <span>В очереди</span>
      </span>
    );
  }
  return null;
};
