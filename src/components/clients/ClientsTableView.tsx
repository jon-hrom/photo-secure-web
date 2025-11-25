import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import { useTableSort, SortableColumn } from '@/hooks/useTableSort';
import { useViewPresets } from '@/hooks/useViewPresets';
import ViewPresetsDropdown from '@/components/clients/ViewPresetsDropdown';

interface ClientsTableViewProps {
  clients: Client[];
  onSelectClient: (client: Client) => void;
  externalSearchQuery?: string;
  externalStatusFilter?: 'all' | 'active' | 'inactive';
}

const ClientsTableView = ({ clients, onSelectClient, externalSearchQuery = '', externalStatusFilter = 'all' }: ClientsTableViewProps) => {
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery);
  const [statusFilter, setStatusFilter] = useState(externalStatusFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const { sortConfigs, handleSort, clearSort, getSortDirection, getSortPriority, sortData, hasSorting, setSortConfigs } = useTableSort<Client>();
  const presets = useViewPresets();

  useEffect(() => {
    setSearchQuery(externalSearchQuery);
  }, [externalSearchQuery]);

  useEffect(() => {
    setStatusFilter(externalStatusFilter);
  }, [externalStatusFilter]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        client.name.toLowerCase().includes(query) ||
        client.phone.includes(query) ||
        client.email.toLowerCase().includes(query)
      );

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      
      const hasActiveProjects = (client.projects || []).some(p => p.status !== 'completed' && p.status !== 'cancelled');
      const hasActiveBookings = (client.bookings || []).some(b => {
        const bookingDate = new Date(b.booking_date || b.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return bookingDate >= today;
      });
      const isActive = hasActiveProjects || hasActiveBookings;
      
      if (statusFilter === 'active') return isActive;
      if (statusFilter === 'inactive') return !isActive;
      
      return true;
    });
  }, [clients, searchQuery, statusFilter]);

  const sortedClients = useMemo(() => {
    return sortData(filteredClients, columns);
  }, [filteredClients, sortData, columns]);

  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClients = sortedClients.slice(startIndex, startIndex + itemsPerPage);

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

  const columns: SortableColumn<Client>[] = useMemo(() => [
    {
      key: 'name',
      label: 'Клиент',
      sortable: true,
      compareFn: (a, b, dir) => {
        const comparison = a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        return dir === 'asc' ? comparison : -comparison;
      }
    },
    {
      key: 'phone',
      label: 'Телефон',
      sortable: true,
      compareFn: (a, b, dir) => {
        const aNorm = a.phone.replace(/\D/g, '');
        const bNorm = b.phone.replace(/\D/g, '');
        const comparison = aNorm.localeCompare(bNorm);
        return dir === 'asc' ? comparison : -comparison;
      }
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      compareFn: (a, b, dir) => {
        const aEmail = (a.email || '').toLowerCase();
        const bEmail = (b.email || '').toLowerCase();
        if (!aEmail) return 1;
        if (!bEmail) return -1;
        const comparison = aEmail.localeCompare(bEmail);
        return dir === 'asc' ? comparison : -comparison;
      }
    },
    {
      key: 'activeProjects',
      label: 'Проекты',
      sortable: true,
      compareFn: (a, b, dir) => {
        const aCount = getActiveProjectsCount(a);
        const bCount = getActiveProjectsCount(b);
        return dir === 'asc' ? aCount - bCount : bCount - aCount;
      }
    },
    {
      key: 'activeBookings',
      label: 'Записи',
      sortable: true,
      compareFn: (a, b, dir) => {
        const aCount = getActiveBookingsCount(a);
        const bCount = getActiveBookingsCount(b);
        return dir === 'asc' ? aCount - bCount : bCount - aCount;
      }
    },
  ], []);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleColumnSort = (columnKey: string, event: React.MouseEvent) => {
    handleSort(columnKey, event.shiftKey);
    setCurrentPage(1);
    presets.clearActivePreset();
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = presets.applyPreset(presetId);
    if (preset) {
      setSearchQuery(preset.searchQuery);
      setStatusFilter(preset.statusFilter);
      setSortConfigs(preset.sortConfigs);
      setCurrentPage(1);
    }
  };

  const handleSavePreset = (presetData: any) => {
    presets.savePreset(presetData);
  };

  const handleDeletePreset = (presetId: string) => {
    presets.deletePreset(presetId);
  };

  const renderSortIndicator = (columnKey: string) => {
    const direction = getSortDirection(columnKey);
    const priority = getSortPriority(columnKey);
    
    if (direction === null) {
      return (
        <Icon name="ChevronsUpDown" size={14} className="ml-1 opacity-0 group-hover:opacity-40 transition-opacity" />
      );
    }
    
    return (
      <div className="ml-1 flex items-center gap-1">
        <Icon 
          name={direction === 'asc' ? 'ChevronUp' : 'ChevronDown'} 
          size={14} 
          className="text-primary"
        />
        {sortConfigs.length > 1 && priority !== null && (
          <span className="text-xs text-primary font-semibold">{priority + 1}</span>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="border-b space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Все клиенты ({sortedClients.length})</h3>
            {hasSorting && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearSort();
                  presets.clearActivePreset();
                }}
                className="h-7 text-xs gap-1 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Icon name="X" size={14} />
                Сбросить
              </Button>
            )}
          </div>
          <div className="relative w-full max-w-sm">
            <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск клиента..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
                presets.clearActivePreset();
              }}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-3">
          <ViewPresetsDropdown
            allPresets={presets.allPresets}
            defaultPresets={presets.defaultPresets}
            customPresets={presets.customPresets}
            activePresetId={presets.activePresetId}
            onApplyPreset={handleApplyPreset}
            onSavePreset={handleSavePreset}
            onDeletePreset={handleDeletePreset}
            currentState={{
              searchQuery,
              statusFilter,
              sortConfigs,
            }}
          />
          
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                presets.clearActivePreset();
              }}
            >
              Все
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter('active');
                presets.clearActivePreset();
              }}
              className="gap-1"
            >
              <Icon name="CheckCircle" size={14} />
              Активные
            </Button>
            <Button
              variant={statusFilter === 'inactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter('inactive');
                presets.clearActivePreset();
              }}
              className="gap-1"
            >
              <Icon name="XCircle" size={14} />
              Неактивные
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    className={`p-4 text-sm font-medium text-muted-foreground whitespace-nowrap ${
                      index < 3 ? 'text-left' : 'text-center'
                    } ${
                      column.sortable ? 'cursor-pointer select-none group hover:bg-accent/50 transition-colors' : ''
                    }`}
                    onClick={(e) => column.sortable && handleColumnSort(column.key, e)}
                    aria-sort={getSortDirection(column.key) || 'none'}
                    title={column.sortable ? 'Кликните для сортировки, Shift+клик для мультисортировки' : undefined}
                  >
                    <div className="flex items-center justify-start gap-1">
                      <span>{column.label}</span>
                      {column.sortable && renderSortIndicator(column.key)}
                    </div>
                  </th>
                ))}
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