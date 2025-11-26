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
          )
          
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
              className="rounded-full transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-purple-100 via-pink-50 to-rose-100 hover:from-purple-200 hover:via-pink-100 hover:to-rose-200 text-purple-700 hover:text-purple-800 border border-purple-200/50"
            >
              <Icon name="Users" size={20} className="mr-2" />
              Мои клиенты
            </Button>
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
            variant="outline"
            onClick={() => setStatusFilter('all')}
            className={`text-xs sm:text-sm rounded-full transition-all hover:scale-105 active:scale-95 ${
              statusFilter === 'all'
                ? 'bg-gradient-to-r from-purple-100 via-pink-50 to-rose-100 text-purple-700 border-purple-200/50 hover:from-purple-200 hover:via-pink-100 hover:to-rose-200'
                : 'hover:bg-purple-50 hover:border-purple-200'
            }`}
          >
            Все ({totalClients})
          </Button>
          <Button
            variant="outline"
            onClick={() => setStatusFilter('active')}
            className={`text-xs sm:text-sm rounded-full transition-all hover:scale-105 active:scale-95 ${
              statusFilter === 'active'
                ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border-emerald-200/50 hover:from-emerald-200 hover:to-green-200'
                : 'hover:bg-emerald-50 hover:border-emerald-200'
            }`}
          >
            <Icon name="CheckCircle" size={16} className="mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Активные</span>
            <span className="xs:hidden">Акт.</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setStatusFilter('inactive')}
            className={`text-xs sm:text-sm rounded-full transition-all hover:scale-105 active:scale-95 ${
              statusFilter === 'inactive'
                ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border-orange-200/50 hover:from-orange-200 hover:to-amber-200'
                : 'hover:bg-orange-50 hover:border-orange-200'
            }`}
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