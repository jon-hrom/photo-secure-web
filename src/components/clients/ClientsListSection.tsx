import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import ClientCard from '@/components/clients/ClientCard';
import { Client } from '@/components/clients/ClientsTypes';

interface ClientsListSectionProps {
  filteredClients: Client[];
  onSelectClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (clientId: number) => void;
  onAddBooking: (client: Client) => void;
}

const ClientsListSection = ({
  filteredClients,
  onSelectClient,
  onEditClient,
  onDeleteClient,
  onAddBooking,
}: ClientsListSectionProps) => {
  return (
    <div className="lg:col-span-2 space-y-4">
      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon name="Search" size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Клиенты не найдены</p>
            <p className="text-sm text-muted-foreground mt-1">
              Попробуйте изменить параметры поиска
            </p>
          </CardContent>
        </Card>
      ) : (
        filteredClients.map(client => (
          <ClientCard
            key={client.id}
            client={client}
            onSelect={() => onSelectClient(client)}
            onEdit={() => onEditClient(client)}
            onDelete={() => onDeleteClient(client.id)}
            onAddBooking={() => onAddBooking(client)}
          />
        ))
      )}
    </div>
  );
};

export default ClientsListSection;
