import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ClientDialogs from '@/components/clients/ClientDialogs';
import { Client } from '@/components/clients/ClientsTypes';
import { FilterType } from '@/components/clients/ClientsFilterSidebar';
import ShootingStyleFilterButton from '@/components/clients/ShootingStyleFilterButton';

interface ClientsHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: 'all' | 'active' | 'inactive';
  setStatusFilter: (filter: 'all' | 'active' | 'inactive') => void;
  totalClients: number;
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
  isEditDialogOpen: boolean;
  setIsEditDialogOpen: (open: boolean) => void;
  newClient: {
    name: string;
    phone: string;
    email: string;
    address: string;
    vkProfile: string;
  };
  setNewClient: (client: any) => void;
  editingClient: Client | null;
  setEditingClient: (client: Client | null) => void;
  handleAddClient: () => void;
  handleUpdateClient: () => void;
  emailVerified: boolean;
  viewMode?: 'cards' | 'table';
  setViewMode?: (mode: 'cards' | 'table') => void;
  onExportClick?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
  clients?: Client[];
}

const ClientsHeader = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  totalClients,
  isAddDialogOpen,
  setIsAddDialogOpen,
  isEditDialogOpen,
  setIsEditDialogOpen,
  newClient,
  setNewClient,
  editingClient,
  setEditingClient,
  handleAddClient,
  handleUpdateClient,
  emailVerified,
  viewMode = 'cards',
  setViewMode,
  onExportClick,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  activeFilter,
  onFilterChange,
  clients = [],
}: ClientsHeaderProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-2xl sm:text-3xl font-bold">Система учёта клиентов</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(onGoBack || onGoForward) && (
            <div className="flex items-center gap-1 border rounded-full p-1 bg-background shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={onGoBack}
                disabled={!canGoBack}
                className="h-8 px-2 sm:px-3 rounded-full hover:bg-accent disabled:opacity-30 transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
                title="Назад"
              >
                <Icon name="ChevronLeft" size={18} />
                <span className="text-sm hidden sm:inline">Назад</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onGoForward}
                disabled={!canGoForward}
                className="h-8 px-2 sm:px-3 rounded-full hover:bg-accent disabled:opacity-30 transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
                title="Вперёд"
              >
                <span className="text-sm hidden sm:inline">Вперёд</span>
                <Icon name="ChevronRight" size={18} />
              </Button>
            </div>
          )}
          
          <ClientDialogs
            isAddDialogOpen={isAddDialogOpen}
            setIsAddDialogOpen={setIsAddDialogOpen}
            isEditDialogOpen={isEditDialogOpen}
            setIsEditDialogOpen={setIsEditDialogOpen}
            newClient={newClient}
            setNewClient={setNewClient}
            editingClient={editingClient}
            setEditingClient={setEditingClient}
            handleAddClient={handleAddClient}
            handleUpdateClient={handleUpdateClient}
            emailVerified={emailVerified}
          />
          
          {setViewMode && (
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              onClick={() => setViewMode('table')}
              className={`rounded-full transition-all hover:scale-105 active:scale-95 ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-purple-100 via-pink-50 to-rose-100 hover:from-purple-200 hover:via-pink-100 hover:to-rose-200 text-purple-700 hover:text-purple-800 border border-purple-200/50'
              }`}
            >
              <Icon name="Users" size={20} className="mr-2" />
              Мои клиенты
            </Button>
          )}

          {activeFilter !== undefined && onFilterChange && (
            <ShootingStyleFilterButton
              activeFilter={activeFilter}
              onFilterChange={onFilterChange}
              clients={clients}
            />
          )}

          {onExportClick && (
            <Button
              onClick={onExportClick}
              className="rounded-full bg-gradient-to-r from-emerald-100 to-green-100 hover:from-emerald-200 hover:to-green-200 text-emerald-700 hover:text-emerald-800 shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 border border-emerald-200/50"
            >
              <Icon name="Download" size={20} className="mr-2" />
              Экспорт
            </Button>
          )}
        </div>
      </div>


    </div>
  );
};

export default ClientsHeader;