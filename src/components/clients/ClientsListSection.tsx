import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
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
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getClientInitials = (name: string) => {
    const words = name.split(' ');
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const getActiveBookingsCount = (client: Client) => {
    return client.bookings.filter(b => new Date(b.date) >= new Date()).length;
  };

  const getActiveProjectsCount = (client: Client) => {
    return (client.projects || []).filter(p => p.status === 'in_progress' || p.status === 'new').length;
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-green-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      case 'cancelled': return 'bg-gray-400';
      default: return 'bg-gray-300';
    }
  };

  const hasAnyProjects = (client: Client) => {
    return (client.projects || []).length > 0;
  };

  const getTotalPaid = (client: Client) => {
    return (client.payments || []).filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  };

  const getDocumentsCount = (client: Client) => {
    return (client.documents || []).length;
  };

  return (
    <div className="lg:col-span-2">
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
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Клиент</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden md:table-cell">Контакты</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground hidden lg:table-cell">Записи</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground hidden lg:table-cell">Проекты</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground hidden xl:table-cell">Оплачено</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground hidden xl:table-cell">Документы</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const activeBookings = getActiveBookingsCount(client);
                    const activeProjects = getActiveProjectsCount(client);
                    const totalPaid = getTotalPaid(client);
                    const documentsCount = getDocumentsCount(client);

                    return (
                      <tr
                        key={client.id}
                        className="border-b hover:bg-accent/50 transition-colors cursor-pointer relative"
                        onClick={() => onSelectClient(client)}
                      >
                        {hasAnyProjects(client) && (
                          <td className="absolute left-0 top-0 bottom-0 w-1 p-0 z-10">
                            <div className="h-full flex flex-col">
                              {(client.projects || []).map((project, idx) => (
                                <div
                                  key={idx}
                                  className={`flex-1 ${getProjectStatusColor(project.status)}`}
                                  title={`${project.name}: ${project.status}`}
                                />
                              ))}
                            </div>
                          </td>
                        )}
                        <td className={hasAnyProjects(client) ? 'p-3 pl-4' : 'p-3'}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                              {getClientInitials(client.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{client.name}</p>
                              <p className="text-sm text-muted-foreground md:hidden">{client.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Icon name="Phone" size={14} className="text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{client.phone}</span>
                            </div>
                            {client.email && (
                              <div className="flex items-center gap-2">
                                <Icon name="Mail" size={14} className="text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{client.email}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center hidden lg:table-cell">
                          {activeBookings > 0 ? (
                            <div className="inline-flex items-center gap-1 text-blue-600 font-medium">
                              <Icon name="Calendar" size={16} />
                              <span>{activeBookings}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center hidden lg:table-cell">
                          {activeProjects > 0 ? (
                            <div className="inline-flex items-center gap-1 text-purple-600 font-medium">
                              <Icon name="Briefcase" size={16} />
                              <span>{activeProjects}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center hidden xl:table-cell">
                          {totalPaid > 0 ? (
                            <span className="text-green-600 font-medium">
                              {totalPaid.toLocaleString('ru-RU')} ₽
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center hidden xl:table-cell">
                          {documentsCount > 0 ? (
                            <div className="inline-flex items-center gap-1 text-orange-600 font-medium">
                              <Icon name="FileText" size={16} />
                              <span>{documentsCount}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddBooking(client);
                              }}
                              title="Добавить запись"
                            >
                              <Icon name="Plus" size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditClient(client);
                              }}
                              title="Редактировать"
                            >
                              <Icon name="Edit" size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Удалить клиента "${client.name}"?`)) {
                                  onDeleteClient(client.id);
                                }
                              }}
                              title="Удалить"
                            >
                              <Icon name="Trash2" size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientsListSection;