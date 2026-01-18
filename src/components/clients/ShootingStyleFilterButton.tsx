import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Client } from '@/components/clients/ClientsTypes';
import { getShootingStyles, reorderShootingStyle } from '@/data/shootingStyles';
import { FilterType } from '@/components/clients/ClientsFilterSidebar';

interface ShootingStyleFilterButtonProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  clients: Client[];
}

const ShootingStyleFilterButton = ({ activeFilter, onFilterChange, clients }: ShootingStyleFilterButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [styles, setStyles] = useState(getShootingStyles());

  // Обновляем стили при открытии диалога
  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setStyles(getShootingStyles());
    }
    setIsDialogOpen(open);
  };

  const getShootingStyleCount = (styleId: string) => {
    return clients.filter(c => 
      (c.projects || []).some(p => p.shootingStyleId === styleId)
    ).length;
  };

  const isShootingStyleActive = (styleId: string) => {
    return typeof activeFilter === 'object' && 
           activeFilter.type === 'shooting-style' && 
           activeFilter.styleId === styleId;
  };

  const handleReorder = (styleId: string, direction: 'up' | 'down') => {
    const updated = reorderShootingStyle(styleId, direction);
    setStyles(updated);
  };

  const hasActiveStyleFilter = typeof activeFilter === 'object' && activeFilter.type === 'shooting-style';
  const activeStyleName = hasActiveStyleFilter 
    ? styles.find(s => s.id === activeFilter.styleId)?.name 
    : null;

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={hasActiveStyleFilter ? 'default' : 'outline'}
          className={`rounded-full transition-all hover:scale-105 active:scale-95 ${
            hasActiveStyleFilter
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-md'
              : 'bg-gradient-to-r from-purple-100 via-pink-50 to-rose-100 dark:from-purple-950 dark:via-pink-950 dark:to-rose-950 hover:from-purple-200 hover:via-pink-100 hover:to-rose-200 dark:hover:from-purple-900 dark:hover:via-pink-900 dark:hover:to-rose-900 text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200 border border-purple-200/50 dark:border-purple-800/50'
          }`}
        >
          <Icon name="Camera" size={20} className="mr-2" />
          {hasActiveStyleFilter ? (
            <span className="max-w-[150px] truncate">{activeStyleName}</span>
          ) : (
            'Стиль съёмки'
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Camera" size={24} className="text-purple-600 dark:text-purple-400" />
            Выберите стиль съёмки
          </DialogTitle>
          <DialogDescription>
            Показать клиентов с проектами выбранного стиля. Используйте стрелки для изменения порядка.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 max-h-[60vh] overflow-y-auto pr-2">
          {styles.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-muted-foreground">
              <p>Стили съёмок не загружены</p>
            </div>
          ) : (
            styles.map((style, index) => {
              const count = getShootingStyleCount(style.id);
              const isActive = isShootingStyleActive(style.id);
              
              return (
                <div
                  key={style.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all group ${
                    isActive 
                      ? 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-950 dark:to-pink-950 border-purple-300 dark:border-purple-700' 
                      : 'border-transparent hover:border-purple-200 dark:hover:border-purple-800'
                  } ${count === 0 ? 'opacity-50' : ''}`}
                >
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => handleReorder(style.id, 'up')}
                    >
                      <Icon name="ChevronUp" size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === styles.length - 1}
                      onClick={() => handleReorder(style.id, 'down')}
                    >
                      <Icon name="ChevronDown" size={14} />
                    </Button>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (count > 0) {
                        onFilterChange({ type: 'shooting-style', styleId: style.id } as any);
                        setIsDialogOpen(false);
                      }
                    }}
                    disabled={count === 0}
                    className="flex-1 flex items-start gap-3 text-left"
                  >
                    <Icon 
                      name="Camera" 
                      size={18} 
                      className={isActive ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground group-hover:text-primary'}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm ${
                          isActive ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {style.name}
                        </p>
                        <Badge 
                          variant={count > 0 ? (isActive ? 'default' : 'secondary') : 'outline'} 
                          className="text-xs h-5 shrink-0"
                        >
                          {count}
                        </Badge>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
        {hasActiveStyleFilter && (
          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                onFilterChange('all');
                setIsDialogOpen(false);
              }}
              className="w-full"
            >
              <Icon name="X" size={16} className="mr-2" />
              Сбросить фильтр
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShootingStyleFilterButton;