import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';

interface TableRowProps {
  client: Client;
  isSelected: boolean;
  activeProjects: number;
  activeBookings: number;
  onSelectClient: (client: Client) => void;
  onSelectCheckbox: (clientId: number, checked: boolean) => void;
  getClientInitials: (name: string) => string;
}

const TableRow = ({
  client,
  isSelected,
  activeProjects,
  activeBookings,
  onSelectClient,
  onSelectCheckbox,
  getClientInitials,
}: TableRowProps) => {
  return (
    <tr
      className="border-b hover:bg-gradient-to-r hover:from-purple-50/50 hover:via-pink-50/30 hover:to-rose-50/50 transition-all duration-200 cursor-pointer group"
      onClick={() => onSelectClient(client)}
    >
      <td className="p-4" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectCheckbox(client.id, checked as boolean)}
          aria-label={`Выбрать клиента ${client.name}`}
        />
      </td>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-purple-700 font-semibold flex-shrink-0 shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-200">
            {getClientInitials(client.name)}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{client.name}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <Icon name="Phone" size={14} className="text-muted-foreground flex-shrink-0" />
          <span className="text-sm">{client.phone}</span>
        </div>
      </td>
      <td className="p-4">
        {client.email ? (
          <div className="flex items-center gap-2">
            <Icon name="Mail" size={14} className="text-muted-foreground flex-shrink-0" />
            <span className="text-sm truncate max-w-[200px]">{client.email}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-4 text-center">
        {activeProjects > 0 ? (
          <div className="inline-flex items-center gap-1 text-purple-600 font-medium">
            <Icon name="Briefcase" size={16} />
            <span>{activeProjects}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-4 text-center">
        {activeBookings > 0 ? (
          <div className="inline-flex items-center gap-1 text-blue-600 font-medium">
            <Icon name="Calendar" size={16} />
            <span>{activeBookings}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelectClient(client);
          }}
        >
          <Icon name="Eye" size={16} className="mr-2" />
          Открыть
        </Button>
      </td>
    </tr>
  );
};

export default TableRow;
