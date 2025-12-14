import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import { useTableSort, SortableColumn } from '@/hooks/useTableSort';
import { useViewPresets } from '@/hooks/useViewPresets';
import TableHeader from '@/components/clients/table/TableHeader';
import TableColumns from '@/components/clients/table/TableColumns';
import TableRow from '@/components/clients/table/TableRow';
import TablePagination from '@/components/clients/table/TablePagination';
import { toast } from 'sonner';

interface ClientsTableViewProps {
  clients: Client[];
  onSelectClient: (client: Client) => void;
  onDeleteClients?: (clientIds: number[]) => Promise<void>;
  externalSearchQuery?: string;
  externalStatusFilter?: 'all' | 'active' | 'inactive';
}

const ClientsTableView = ({ clients, onSelectClient, onDeleteClients, externalSearchQuery = '', externalStatusFilter = 'all' }: ClientsTableViewProps) => {
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery);
  const [statusFilter, setStatusFilter] = useState(externalStatusFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemsPerPage = 10;
  
  const { sortConfigs, handleSort, clearSort, getSortDirection, getSortPriority, sortData, hasSorting, setSortConfigs } = useTableSort<Client>();
  const presets = useViewPresets();

  useEffect(() => {
    setSearchQuery(externalSearchQuery);
  }, [externalSearchQuery]);

  useEffect(() => {
    setStatusFilter(externalStatusFilter);
  }, [externalStatusFilter]);

  const getClientInitials = useCallback((name: string) => {
    const words = name.split(' ');
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }, []);

  const getActiveProjectsCount = useCallback((client: Client) => {
    return (client.projects || []).filter(p => p.status === 'in_progress' || p.status === 'new').length;
  }, []);

  const getActiveBookingsCount = useCallback((client: Client) => {
    return client.bookings.filter(b => new Date(b.date) >= new Date()).length;
  }, []);

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
  ], [getActiveProjectsCount, getActiveBookingsCount]);

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
  }, [filteredClients, sortData]);

  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClients = sortedClients.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClientIds(paginatedClients.map(c => c.id));
    } else {
      setSelectedClientIds([]);
    }
  };

  const handleSelectClient = (clientId: number, checked: boolean) => {
    if (checked) {
      setSelectedClientIds(prev => [...prev, clientId]);
    } else {
      setSelectedClientIds(prev => prev.filter(id => id !== clientId));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedClientIds.length === 0) return;
    
    if (!confirm(`Вы уверены, что хотите удалить ${selectedClientIds.length} клиент(ов)?`)) {
      return;
    }

    if (!onDeleteClients) {
      toast.error('Функция удаления недоступна');
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteClients(selectedClientIds);
      toast.success(`Удалено ${selectedClientIds.length} клиент(ов)`);
      setSelectedClientIds([]);
    } catch (error) {
      console.error('Error deleting clients:', error);
      toast.error('Ошибка при удалении клиентов');
    } finally {
      setIsDeleting(false);
    }
  };

  const isAllSelected = paginatedClients.length > 0 && selectedClientIds.length === paginatedClients.length;
  const isSomeSelected = selectedClientIds.length > 0 && selectedClientIds.length < paginatedClients.length;

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

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    presets.clearActivePreset();
  };

  const handleStatusFilterChange = (filter: 'all' | 'active' | 'inactive') => {
    setStatusFilter(filter);
    presets.clearActivePreset();
  };

  const handleClearSort = () => {
    clearSort();
    presets.clearActivePreset();
  };

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border border-purple-100/50">
      <CardHeader>
        <TableHeader
          clientsCount={sortedClients.length}
          hasSorting={hasSorting}
          selectedCount={selectedClientIds.length}
          isDeleting={isDeleting}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onClearSort={handleClearSort}
          onDeleteSelected={handleDeleteSelected}
          onSearchChange={handleSearchChange}
          onStatusFilterChange={handleStatusFilterChange}
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
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableColumns
              columns={columns}
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              onSelectAll={handleSelectAll}
              onColumnSort={handleColumnSort}
              getSortDirection={getSortDirection}
              getSortPriority={getSortPriority}
              sortConfigs={sortConfigs}
            />
            <tbody>
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <Icon name="Search" size={48} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Клиенты не найдены</p>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const activeProjects = getActiveProjectsCount(client);
                  const activeBookings = getActiveBookingsCount(client);

                  return (
                    <TableRow
                      key={client.id}
                      client={client}
                      isSelected={selectedClientIds.includes(client.id)}
                      activeProjects={activeProjects}
                      activeBookings={activeBookings}
                      onSelectClient={onSelectClient}
                      onSelectCheckbox={handleSelectClient}
                      getClientInitials={getClientInitials}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          itemsPerPage={itemsPerPage}
          totalItems={filteredClients.length}
          onPageChange={handlePageChange}
        />
      </CardContent>
    </Card>
  );
};

export default ClientsTableView;
