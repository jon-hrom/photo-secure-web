import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';

interface ClientsTableViewProps {
  clients: Client[];
  onSelectClient: (client: Client) => void;
}

const ClientsTableView = ({ clients, onSelectClient }: ClientsTableViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredClients = clients.filter(client => {
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.phone.includes(query) ||
      client.email.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + itemsPerPage);

  const getClientInitials = (name: string) => {
    const words = name.split(' ');
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const getActiveProjectsCount = (client: Client) => {
    return (client.projects || []).filter(p => p.status === 'in_progress' || p.status === 'new').length;
  };

  const getActiveBookingsCount = (client: Client) => {
    return client.bookings.filter(b => new Date(b.date) >= new Date()).length;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">Все клиенты ({filteredClients.length})</h3>
          <div className="relative w-full max-w-sm">
            <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск клиента..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Клиент</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Телефон</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Email</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Проекты</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Записи</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Действия</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Icon name="Search" size={48} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Клиенты не найдены</p>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const activeProjects = getActiveProjectsCount(client);
                  const activeBookings = getActiveBookingsCount(client);

                  return (
                    <tr
                      key={client.id}
                      className="border-b hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => onSelectClient(client)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
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
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Показано {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredClients.length)} из {filteredClients.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <Icon name="ChevronLeft" size={16} />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <Icon name="ChevronRight" size={16} />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientsTableView;
