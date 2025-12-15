import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ClientDialogs from '@/components/clients/ClientDialogs';
import { Client } from '@/components/clients/ClientsTypes';
import { FilterType } from '@/components/clients/ClientsFilterSidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { getShootingStyles, reorderShootingStyle } from '@/data/shootingStyles';
import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

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
          
          {setViewMode && activeFilter && onFilterChange && (
            <ViewsPopover
              viewMode={viewMode}
              setViewMode={setViewMode}
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

interface ViewsPopoverProps {
  viewMode: 'cards' | 'table';
  setViewMode: (mode: 'cards' | 'table') => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  clients: Client[];
}

function ViewsPopover({ viewMode, setViewMode, activeFilter, onFilterChange, clients }: ViewsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [styles, setStyles] = useState(getShootingStyles());

  useEffect(() => {
    if (isOpen) {
      setStyles(getShootingStyles());
    }
  }, [isOpen]);

  const handleReorder = (styleId: string, direction: 'up' | 'down') => {
    reorderShootingStyle(styleId, direction);
    setStyles(getShootingStyles());
  };

  const getShootingStyleCount = (styleId: string) => {
    return clients.filter(c => 
      (c.projects || []).some(p => p.shootingStyleId === styleId)
    ).length;
  };

  const hasActiveStyleFilter = typeof activeFilter === 'object' && activeFilter.type === 'shooting-style';
  const activeStyleName = hasActiveStyleFilter 
    ? styles.find(s => s.id === activeFilter.styleId)?.name 
    : null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={viewMode === 'table' || hasActiveStyleFilter ? 'default' : 'outline'}
          onClick={() => {
            if (!isOpen) {
              setViewMode('table');
            }
          }}
          className={`rounded-full transition-all hover:scale-105 active:scale-95 ${
            hasActiveStyleFilter 
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg'
              : 'bg-gradient-to-r from-purple-100 via-pink-50 to-rose-100 hover:from-purple-200 hover:via-pink-100 hover:to-rose-200 text-purple-700 hover:text-purple-800 border border-purple-200/50'
          }`}
        >
          <Icon name="Users" size={20} className="mr-2" />
          {hasActiveStyleFilter ? activeStyleName : 'Мои клиенты'}
          <Icon name="ChevronDown" size={16} className="ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-4 max-h-[500px] overflow-y-auto" align="start">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
              <Icon name="Camera" size={20} className="text-purple-600" />
              Стиль съёмки (фильтр)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Фильтр клиентов по типу съёмки
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {styles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Стили съёмок не загружены
              </div>
            ) : (
              styles.map((style, index) => {
                const count = getShootingStyleCount(style.id);
                const isActive = typeof activeFilter === 'object' && 
                                activeFilter.type === 'shooting-style' && 
                                activeFilter.styleId === style.id;

                return (
                  <div
                    key={style.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                      isActive 
                        ? 'bg-gradient-to-r from-purple-100 to-pink-100 border-purple-300' 
                        : 'border-transparent hover:bg-accent'
                    } ${count === 0 ? 'opacity-50' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(style.id, 'up');
                        }}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0"
                        disabled={index === styles.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(style.id, 'down');
                        }}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>

                    <button
                      onClick={() => {
                        onFilterChange({ type: 'shooting-style', styleId: style.id } as any);
                        setIsOpen(false);
                      }}
                      disabled={count === 0}
                      className="flex-1 flex items-center justify-between gap-2 text-left"
                    >
                      <span className={`text-sm ${isActive ? 'font-semibold' : ''}`}>
                        {style.name}
                      </span>
                      <Badge 
                        variant={count > 0 ? (isActive ? 'default' : 'secondary') : 'outline'} 
                        className="text-xs shrink-0"
                      >
                        {count}
                      </Badge>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {hasActiveStyleFilter && (
            <div className="pt-3 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  onFilterChange('all');
                  setIsOpen(false);
                }}
                className="w-full"
                size="sm"
              >
                <Icon name="X" size={14} className="mr-2" />
                Сбросить фильтр
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}