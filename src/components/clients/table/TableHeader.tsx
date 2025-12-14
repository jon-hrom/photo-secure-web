import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import ViewPresetsDropdown from '@/components/clients/ViewPresetsDropdown';

interface TableHeaderProps {
  clientsCount: number;
  hasSorting: boolean;
  selectedCount: number;
  isDeleting: boolean;
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'inactive';
  onClearSort: () => void;
  onDeleteSelected: () => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (filter: 'all' | 'active' | 'inactive') => void;
  allPresets: any[];
  defaultPresets: any[];
  customPresets: any[];
  activePresetId: string | null;
  onApplyPreset: (presetId: string) => void;
  onSavePreset: (presetData: any) => void;
  onDeletePreset: (presetId: string) => void;
  currentState: {
    searchQuery: string;
    statusFilter: 'all' | 'active' | 'inactive';
    sortConfigs: any[];
  };
}

const TableHeader = ({
  clientsCount,
  hasSorting,
  selectedCount,
  isDeleting,
  searchQuery,
  statusFilter,
  onClearSort,
  onDeleteSelected,
  onSearchChange,
  onStatusFilterChange,
  allPresets,
  defaultPresets,
  customPresets,
  activePresetId,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  currentState,
}: TableHeaderProps) => {
  return (
    <div className="border-b space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Все клиенты ({clientsCount})</h3>
          {hasSorting && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSort}
              className="h-7 text-xs gap-1 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Icon name="X" size={14} />
              Сбросить
            </Button>
          )}
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteSelected}
              disabled={isDeleting}
              className="h-7 text-xs gap-1"
            >
              {isDeleting ? (
                <>
                  <Icon name="Loader" size={14} className="animate-spin" />
                  Удаление...
                </>
              ) : (
                <>
                  <Icon name="Trash2" size={14} />
                  Удалить ({selectedCount})
                </>
              )}
            </Button>
          )}
        </div>
        <div className="relative w-full max-w-sm">
          <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск клиента..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between gap-3">
        <ViewPresetsDropdown
          allPresets={allPresets}
          defaultPresets={defaultPresets}
          customPresets={customPresets}
          activePresetId={activePresetId}
          onApplyPreset={onApplyPreset}
          onSavePreset={onSavePreset}
          onDeletePreset={onDeletePreset}
          currentState={currentState}
        />
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusFilterChange('all')}
            className={`rounded-full transition-all hover:scale-105 active:scale-95 ${
              statusFilter === 'all'
                ? 'bg-gradient-to-r from-purple-100 via-pink-50 to-rose-100 text-purple-700 border-purple-200/50 hover:from-purple-200 hover:via-pink-100 hover:to-rose-200'
                : 'hover:bg-purple-50 hover:border-purple-200'
            }`}
          >
            Все
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusFilterChange('active')}
            className={`gap-1 rounded-full transition-all hover:scale-105 active:scale-95 ${
              statusFilter === 'active'
                ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border-emerald-200/50 hover:from-emerald-200 hover:to-green-200'
                : 'hover:bg-emerald-50 hover:border-emerald-200'
            }`}
          >
            <Icon name="CheckCircle" size={14} />
            Активные
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusFilterChange('inactive')}
            className={`gap-1 rounded-full transition-all hover:scale-105 active:scale-95 ${
              statusFilter === 'inactive'
                ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border-orange-200/50 hover:from-orange-200 hover:to-amber-200'
                : 'hover:bg-orange-50 hover:border-orange-200'
            }`}
          >
            <Icon name="XCircle" size={14} />
            Неактивные
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TableHeader;
