import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface TrashedPhotosHeaderProps {
  photosCount: number;
  filteredCount: number;
  selectionMode: boolean;
  selectedCount: number;
  loading: boolean;
  searchQuery: string;
  sortBy: 'date' | 'name' | 'size';
  filterCritical: boolean;
  onSetSelectionMode: (mode: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkRestore: () => void;
  onBulkDelete: () => void;
  onSetSearchQuery: (query: string) => void;
  onSetSortBy: (sortBy: 'date' | 'name' | 'size') => void;
  onSetFilterCritical: (filter: boolean) => void;
  onCancelSelection: () => void;
}

const TrashedPhotosHeader = ({
  photosCount,
  filteredCount,
  selectionMode,
  selectedCount,
  loading,
  searchQuery,
  sortBy,
  filterCritical,
  onSetSelectionMode,
  onSelectAll,
  onDeselectAll,
  onBulkRestore,
  onBulkDelete,
  onSetSearchQuery,
  onSetSortBy,
  onSetFilterCritical,
  onCancelSelection
}: TrashedPhotosHeaderProps) => {
  return (
    <CardHeader>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <CardTitle className="flex items-center gap-2">
          <Icon name="Image" size={20} />
          Удаленные фото ({filteredCount}/{photosCount})
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {!selectionMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetSelectionMode(true)}
            >
              <Icon name="CheckSquare" className="mr-2" size={16} />
              Выбрать
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
              >
                Выбрать все
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDeselectAll}
              >
                Снять выбор
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={onBulkRestore}
                disabled={selectedCount === 0 || loading}
              >
                <Icon name="Undo2" className="mr-2" size={16} />
                Восстановить ({selectedCount})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onBulkDelete}
                disabled={selectedCount === 0 || loading}
              >
                <Icon name="Trash2" className="mr-2" size={16} />
                Удалить ({selectedCount})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelSelection}
              >
                Отмена
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск по имени..."
              value={searchQuery}
              onChange={(e) => onSetSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <select
          value={sortBy}
          onChange={(e) => onSetSortBy(e.target.value as any)}
          className="px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="date">По дате</option>
          <option value="name">По имени</option>
          <option value="size">По размеру</option>
        </select>
        <Button
          variant={filterCritical ? "default" : "outline"}
          size="sm"
          onClick={() => onSetFilterCritical(!filterCritical)}
        >
          <Icon name="AlertTriangle" className="mr-2" size={16} />
          Только критичные
        </Button>
      </div>
    </CardHeader>
  );
};

export default TrashedPhotosHeader;
