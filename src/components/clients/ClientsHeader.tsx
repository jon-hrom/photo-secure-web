import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ClientDialogs from '@/components/clients/ClientDialogs';
import { Client } from '@/components/clients/ClientsTypes';

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
}: ClientsHeaderProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl sm:text-3xl font-bold">Система учёта клиентов</h2>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-full p-1 bg-background shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={onGoBack}
                disabled={!canGoBack}
                className="h-8 w-8 p-0 rounded-full hover:bg-accent disabled:opacity-30 transition-all hover:scale-110 active:scale-95"
                title="Назад"
              >
                <Icon name="ChevronLeft" size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onGoForward}
                disabled={!canGoForward}
                className="h-8 w-8 p-0 rounded-full hover:bg-accent disabled:opacity-30 transition-all hover:scale-110 active:scale-95"
                title="Вперёд"
              >
                <Icon name="ChevronRight" size={18} />
              </Button>
            </div>

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
                className="rounded-full transition-all hover:scale-105 active:scale-95"
              >
                <Icon name="Users" size={20} className="mr-2" />
                Мои клиенты
              </Button>
            )}
          </div>
        </div>
        
        {onExportClick && (
          <Button
            onClick={onExportClick}
            className="rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <Icon name="Download" size={20} className="mr-2" />
            Экспорт
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, телефону или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className="text-xs sm:text-sm"
          >
            Все ({totalClients})
          </Button>
          <Button
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('active')}
            className="text-xs sm:text-sm"
          >
            <Icon name="CheckCircle" size={16} className="mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Активные</span>
            <span className="xs:hidden">Акт.</span>
          </Button>
          <Button
            variant={statusFilter === 'inactive' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('inactive')}
            className="text-xs sm:text-sm"
          >
            <Icon name="XCircle" size={16} className="mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Неактивные</span>
            <span className="xs:hidden">Неакт.</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClientsHeader;