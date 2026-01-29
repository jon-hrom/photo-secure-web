import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface DateFilterProps {
  selectedDate: string | null;
  availableDates: string[];
  filteredCount: number;
  uploading: boolean;
  onDateSelect: (date: string | null) => void;
}

const DateFilter = ({
  selectedDate,
  availableDates,
  filteredCount,
  uploading,
  onDateSelect
}: DateFilterProps) => {
  if (availableDates.length === 0) return null;

  return (
    <div className="space-y-2 border-t dark:border-gray-700 pt-4">
      <div className="flex items-center justify-between">
        <Label className="text-foreground text-base font-semibold">Фильтр по дате съёмки</Label>
        {selectedDate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDateSelect(null)}
            disabled={uploading}
            className="text-foreground"
          >
            <Icon name="X" className="mr-1" size={14} />
            Сбросить
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
        {availableDates.map(date => (
          <Button
            key={date}
            variant={selectedDate === date ? 'default' : 'outline'}
            onClick={() => onDateSelect(selectedDate === date ? null : date)}
            disabled={uploading}
            size="sm"
            style={{
              color: selectedDate === date ? 'white' : 'inherit'
            }}
          >
            {date}
          </Button>
        ))}
      </div>
      
      {selectedDate && (
        <p className="text-sm text-muted-foreground">
          Найдено файлов за {selectedDate}: {filteredCount}
        </p>
      )}
    </div>
  );
};

export default DateFilter;