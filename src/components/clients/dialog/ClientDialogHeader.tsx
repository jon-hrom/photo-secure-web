import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { formatPhoneNumber } from '@/utils/phoneFormat';
import { Client } from '@/components/clients/ClientsTypes';
import { useState } from 'react';
import { toast } from 'sonner';

interface ClientDialogHeaderProps {
  localClient: Client;
  onUpdate: (client: Client) => void;
  setLocalClient: (client: Client) => void;
}

const INVITE_API = 'https://functions.poehali.dev/3128bc7e-f0d6-4d0a-a73e-91eb657795a0';

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
    <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 pr-12">
      <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-2xl min-w-0">
        <Icon name="User" size={22} className="text-primary shrink-0 sm:w-7 sm:h-7" />
        <span className="truncate min-w-0">{client.name}</span>
      </DialogTitle>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs sm:text-sm text-muted-foreground">
        <div className="flex items-center gap-1 min-w-0 max-w-full">
          <Icon name="Phone" size={14} className="shrink-0" />
          <span className="truncate">{formatPhoneNumber(client.phone)}</span>
        </div>
        {client.email && (
          <div className="flex items-center gap-1 min-w-0 max-w-full">
            <Icon name="Mail" size={14} className="shrink-0" />
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