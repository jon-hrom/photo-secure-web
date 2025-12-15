import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import { formatPhoneNumber } from '@/utils/phoneFormat';

interface ClientCardProps {
  client: Client;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddBooking: () => void;
}

const ClientCard = ({ client, onSelect, onEdit, onDelete, onAddBooking }: ClientCardProps) => {
  const activeBookings = client.bookings.filter(b => b.date >= new Date());
  const pastBookings = client.bookings.filter(b => b.date < new Date());
  
  const projects = client.projects || [];
  const payments = client.payments || [];
  const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'new');
  const totalPaid = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);

  return (
    <Card className="hover-scale cursor-pointer" onClick={onSelect} data-tour="client-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon name="User" className="text-primary flex-shrink-0" />
            <span className="truncate">{client.name}</span>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Icon name="Edit" size={16} />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Удалить клиента?')) onDelete();
              }}
            >
              <Icon name="Trash2" size={16} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="Phone" size={16} className="text-muted-foreground flex-shrink-0" />
            <span className="truncate">{formatPhoneNumber(client.phone)}</span>
          </div>
          {client.email && (
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="Mail" size={16} className="text-muted-foreground flex-shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="MapPin" size={16} className="text-muted-foreground flex-shrink-0" />
              <span className="truncate">{client.address}</span>
            </div>
          )}
          {client.vkProfile && (
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="MessageCircle" size={16} className="text-muted-foreground flex-shrink-0" />
              <span className="truncate">@{client.vkProfile}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
          {activeProjects.length > 0 && (
            <div className="flex items-center gap-1 text-blue-600">
              <Icon name="Briefcase" size={14} />
              <span>{activeProjects.length} проект(-ов)</span>
            </div>
          )}
          {totalPaid > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <Icon name="DollarSign" size={14} />
              <span>{totalPaid.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t">
          <div className="flex gap-2 flex-wrap">
            {activeBookings.length > 0 && (
              <Badge variant="default">
                <Icon name="Calendar" size={12} className="mr-1" />
                {activeBookings.length} активных
              </Badge>
            )}
            {pastBookings.length > 0 && (
              <Badge variant="secondary">
                <Icon name="CheckCircle" size={12} className="mr-1" />
                {pastBookings.length} завершено
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={(e) => {
              e.stopPropagation();
              onAddBooking();
            }}
          >
            <Icon name="Plus" size={16} className="mr-1" />
            Запись
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientCard;