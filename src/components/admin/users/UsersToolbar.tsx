import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import type { User } from './types';
import { exportToCSV } from './types';

interface UsersToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: 'date' | 'email' | 'lastLogin';
  onSortChange: (value: 'date' | 'email' | 'lastLogin') => void;
  filterByActivity: 'all' | 'active' | 'inactive';
  onFilterChange: (value: 'all' | 'active' | 'inactive') => void;
  filteredCount: number;
  totalCount: number;
  filteredUsers: User[];
  onRefresh?: () => void;
  isRefreshing: boolean;
  onSetRefreshing: (value: boolean) => void;
}

const UsersToolbar = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  filterByActivity,
  onFilterChange,
  filteredCount,
  totalCount,
  filteredUsers,
  onRefresh,
  isRefreshing,
  onSetRefreshing,
}: UsersToolbarProps) => {
  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Поиск по email, телефону или IP адресу..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={sortBy} onValueChange={(value: string) => onSortChange(value as 'date' | 'email' | 'lastLogin')}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">По дате регистрации</SelectItem>
            <SelectItem value="email">По email</SelectItem>
            <SelectItem value="lastLogin">По последнему входу</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterByActivity} onValueChange={(value: string) => onFilterChange(value as 'all' | 'active' | 'inactive')}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Активность" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="inactive">Неактивные</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3">
        {searchQuery ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="Info" size={16} />
            <span>Найдено: {filteredCount} из {totalCount}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSearchChange('')}
              className="h-7 gap-1"
            >
              <Icon name="X" size={14} />
              Сбросить
            </Button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Всего пользователей: {totalCount}
          </div>
        )}

        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                onSetRefreshing(true);
                await onRefresh();
                setTimeout(() => onSetRefreshing(false), 500);
              }}
              disabled={isRefreshing}
              className="gap-2"
            >
              <Icon name="RefreshCw" size={16} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Обновление...' : 'Обновить'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(filteredUsers)}
            className="gap-2"
            disabled={filteredUsers.length === 0}
          >
            <Icon name="Download" size={16} />
            Экспорт в CSV
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UsersToolbar;