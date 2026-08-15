import Icon from '@/components/ui/icon';
import { SortField, SortDirection, FrameMode } from './photoGridTypes';

interface PhotoGridToolbarProps {
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  frameMode: FrameMode;
  setFrameMode: (mode: FrameMode) => void;
}

const PhotoGridToolbar = ({
  sortField,
  sortDirection,
  onSortChange,
  frameMode,
  setFrameMode,
}: PhotoGridToolbarProps) => {
  return (
    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
      <span className="text-xs text-muted-foreground mr-1">Сортировка:</span>
      {([
        { field: 'name' as SortField, label: 'По имени' },
        { field: 'shot_date' as SortField, label: 'По дате съёмки' },
        { field: 'shot_time' as SortField, label: 'По времени' },
        { field: 'created_at' as SortField, label: 'По дате загрузки' },
      ]).map(({ field, label }) => (
        <button
          key={field}
          onClick={() => onSortChange(field)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            sortField === field 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {label}
          {sortField === field && (
            <Icon name={sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown'} size={12} />
          )}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Рамки:</span>
        {([
          { mode: 'none' as const, label: 'Нет', icon: 'Square' },
          { mode: 'theme' as const, label: 'Тема', icon: 'Frame' },
          { mode: 'adaptive' as const, label: 'Адаптивные', icon: 'Palette' },
        ]).map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => setFrameMode(mode)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              frameMode === mode
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Icon name={icon} size={12} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PhotoGridToolbar;
