import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { formatPhoneNumber } from '@/utils/phoneFormat';
import { Client } from '@/components/clients/ClientsTypes';
import { useState } from 'react';
import { toast } from 'sonner';
import func2url from '../../../../backend/func2url.json';

interface ClientDialogHeaderProps {
  localClient: Client;
  onUpdate: (client: Client) => void;
  setLocalClient: (client: Client) => void;
}

const INVITE_API = func2url['telegram-invite'];

const ClientDialogHeader = ({ localClient, onUpdate, setLocalClient }: ClientDialogHeaderProps) => {
  const client = localClient;
  const [inviteLoading, setInviteLoading] = useState(false);
  const hasTelegram = !!client.telegram_chat_id;

  const handleInviteTelegram = async () => {
    setInviteLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      const res = await fetch(`${INVITE_API}?action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          photographer_id: Number(userId),
          client_phone: client.phone,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      await navigator.clipboard.writeText(data.invite_url);
      toast.success('Ссылка скопирована! Отправьте её клиенту');
    } catch {
      toast.error('Не удалось создать ссылку');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 sm:gap-3 text-xl sm:text-2xl">
        <Icon name="User" size={24} className="text-primary sm:w-7 sm:h-7" />
        <span className="truncate">{client.name}</span>
      </DialogTitle>
      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Icon name="Phone" size={14} />
          <span className="truncate">{formatPhoneNumber(client.phone)}</span>
        </div>
        {client.email && (
          <div className="flex items-center gap-1">
            <Icon name="Mail" size={14} />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.vkProfile && (
          <div className="flex items-center gap-1">
            <Icon name="MessageCircle" size={14} />
            <span className="truncate">@{client.vkProfile}</span>
          </div>
        )}
        {hasTelegram ? (
          <div className="flex items-center gap-1 text-green-600">
            <Icon name="Send" size={14} />
            <span>Telegram подключен</span>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
            onClick={handleInviteTelegram}
            disabled={inviteLoading}
          >
            <Icon name="Send" size={12} className="mr-1" />
            {inviteLoading ? 'Создаю...' : 'Пригласить в Telegram'}
          </Button>
        )}
      </div>
    </DialogHeader>
  );
};

export default ClientDialogHeader;