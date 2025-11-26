import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const Clients = () => {
  const clients = [
    { name: 'Анна Смирнова', email: 'anna@example.com', photos: 45, status: 'active' },
    { name: 'Иван Петров', email: 'ivan@example.com', photos: 32, status: 'active' },
    { name: 'Мария Козлова', email: 'maria@example.com', photos: 78, status: 'inactive' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Клиенты</h1>
          <Button className="gap-2">
            <Icon name="UserPlus" size={18} />
            Добавить клиента
          </Button>
        </div>
        
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Имя</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Фотографий</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Статус</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clients.map((client, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white font-medium">
                          {client.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{client.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                        <Icon name="Image" size={14} />
                        {client.photos}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                        client.status === 'active' 
                          ? 'bg-green-50 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {client.status === 'active' ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Icon name="Eye" size={16} />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Icon name="Edit" size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {clients.length === 0 && (
          <div className="text-center py-12">
            <Icon name="Users" size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Нет клиентов</h3>
            <p className="text-gray-600 mb-6">Добавьте первого клиента для начала работы</p>
            <Button className="gap-2">
              <Icon name="UserPlus" size={18} />
              Добавить клиента
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Clients;
