import Icon from '@/components/ui/icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Client {
  id: number;
  name: string;
  phone: string;
}

interface ClientSelectorProps {
  clients: Client[];
  selectedClient: Client | null;
  onClientChange: (clientId: string) => void;
}

export default function ClientSelector({ clients, selectedClient, onClientChange }: ClientSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Клиент</label>
      {clients.length === 0 ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="AlertCircle" size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                У вас пока нет клиентов
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                Создайте карточку клиента в разделе "Клиенты", чтобы связать её с папкой и отправлять ссылки через MAX
              </p>
              <a
                href="/clients"
                className="inline-flex items-center gap-2 text-sm font-medium text-yellow-900 dark:text-yellow-200 hover:underline"
              >
                <Icon name="UserPlus" size={16} />
                Перейти к клиентам
              </a>
            </div>
          </div>
        </div>
      ) : (
        <Select value={selectedClient?.id.toString()} onValueChange={onClientChange}>
          <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
            <SelectValue placeholder="Выберите клиента" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
            {clients.map(client => (
              <SelectItem 
                key={client.id} 
                value={client.id.toString()}
                className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="block truncate">{client.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{client.phone}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
