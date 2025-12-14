import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { SortableColumn } from '@/hooks/useTableSort';
import { Client } from '@/components/clients/ClientsTypes';

interface TableColumnsProps {
  columns: SortableColumn<Client>[];
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onSelectAll: (checked: boolean) => void;
  onColumnSort: (columnKey: string, event: React.MouseEvent) => void;
  getSortDirection: (columnKey: string) => 'asc' | 'desc' | null;
  getSortPriority: (columnKey: string) => number | null;
  sortConfigs: any[];
}

const TableColumns = ({
  columns,
  isAllSelected,
  isSomeSelected,
  onSelectAll,
  onColumnSort,
  getSortDirection,
  getSortPriority,
  sortConfigs,
}: TableColumnsProps) => {
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
    <thead>
      <tr className="border-b bg-muted/50">
        <th className="p-4 w-12">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={onSelectAll}
            aria-label="Выбрать всех клиентов"
            className={isSomeSelected ? 'data-[state=checked]:bg-gray-400' : ''}
          />
        </th>
        {columns.map((column, index) => (
          <th
            key={column.key}
            className={`p-4 text-sm font-medium text-muted-foreground whitespace-nowrap ${
              index < 3 ? 'text-left' : 'text-center'
            } ${
              column.sortable ? 'cursor-pointer select-none group hover:bg-accent/50 transition-colors' : ''
            }`}
            onClick={(e) => column.sortable && onColumnSort(column.key, e)}
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
  );
};

export default TableColumns;
