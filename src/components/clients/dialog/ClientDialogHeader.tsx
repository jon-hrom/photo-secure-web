import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { formatPhoneNumber } from '@/utils/phoneFormat';
import { Client } from '@/components/clients/ClientsTypes';

interface ClientDialogHeaderProps {
  localClient: Client;
  onUpdate: (client: Client) => void;
  setLocalClient: (client: Client) => void;
}

const ClientDialogHeader = ({ localClient }: ClientDialogHeaderProps) => {
  const client = localClient;
  return (
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 sm:gap-3 text-xl sm:text-2xl">
        <Icon name="User" size={24} className="text-primary sm:w-7 sm:h-7" />
        <span className="truncate">{client.name}</span>
      </DialogTitle>
      <div className="flex flex-wrap gap-2 mt-2 text-xs sm:text-sm text-muted-foreground">
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
      </div>
    </DialogHeader>
  );
};

export default ClientDialogHeader;