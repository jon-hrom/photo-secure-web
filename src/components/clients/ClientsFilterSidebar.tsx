import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import { getShootingStyles } from '@/data/shootingStyles';
import { Badge } from '@/components/ui/badge';

export type FilterType = 
  | 'all' 
  | 'active-projects' 
  | 'upcoming-meetings' 
  | 'new-clients' 
  | 'alphabetical' 
  | 'most-projects'
  | { type: 'shooting-style', styleId: string };

interface ClientsFilterSidebarProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  clients: Client[];
}

const ClientsFilterSidebar = ({ activeFilter, onFilterChange, clients }: ClientsFilterSidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showShootingStyles, setShowShootingStyles] = useState(false);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const shootingStyles = getShootingStyles();

  const getFilterCounts = () => {
    const activeProjects = clients.filter(c => 
      (c.projects || []).some(p => p.status !== 'completed' && p.status !== 'cancelled')
    ).length;

    const upcomingMeetings = clients.filter(c =>
      (c.bookings || []).some(b => {
        const bookingDate = new Date(b.booking_date || b.date);
        return bookingDate >= now;
      })
    ).length;

    const newClients = clients.filter(c => {
      if (!c.created_at) return false;
      const createdDate = new Date(c.created_at);
      return createdDate >= sevenDaysAgo;
    }).length;

    return { activeProjects, upcomingMeetings, newClients };
  };

  const counts = getFilterCounts();

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

  const filters = [
    {
      id: 'all' as FilterType,
      icon: 'Users',
      label: 'Все клиенты',
      description: `Полный список • ${clients.length} клиентов`,
      count: clients.length,
    },
    {
      id: 'active-projects' as FilterType,
      icon: 'Briefcase',
      label: 'Активные проекты',
      description: 'Клиенты с активными проектами',
      count: counts.activeProjects,
    },
    {
      id: 'upcoming-meetings' as FilterType,
      icon: 'Calendar',
      label: 'Ближайшие встречи',
      description: 'Клиенты с запланированными встречами',
      count: counts.upcomingMeetings,
    },
    {
      id: 'new-clients' as FilterType,
      icon: 'UserPlus',
      label: 'Новые клиенты',
      description: 'Добавлены за последние 7 дней',
      count: counts.newClients,
    },
    {
      id: 'alphabetical' as FilterType,
      icon: 'ArrowDownAZ',
      label: 'По алфавиту',
      description: 'Сортировка по имени А-Я',
      count: null,
    },
    {
      id: 'most-projects' as FilterType,
      icon: 'TrendingUp',
      label: 'Больше всего проектов',
      description: 'Топ клиентов по количеству проектов',
      count: null,
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-purple-200/50 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Фильтры и сортировка</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={20} />
            </Button>
          </div>

          {isExpanded && (
            <div className="space-y-1">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => onFilterChange(filter.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all hover:bg-accent group ${
                    activeFilter === filter.id ? 'bg-gradient-to-r from-purple-100 to-pink-100' : ''
                  }`}
                >
                  <Icon 
                    name={filter.icon as any} 
                    size={20} 
                    className={activeFilter === filter.id ? 'text-purple-600' : 'text-muted-foreground group-hover:text-primary'}
                  />
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${activeFilter === filter.id ? 'text-gray-900 font-semibold' : ''}`}>
                        {filter.label}
                      </p>
                      {filter.count !== null && (
                        <span className="text-xs text-muted-foreground">{filter.count}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{filter.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-purple-200/50 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold">По стилю съёмки</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShootingStyles(!showShootingStyles)}
              className="h-8 w-8 p-0"
            >
              <Icon name={showShootingStyles ? 'ChevronUp' : 'ChevronDown'} size={20} />
            </Button>
          </div>

          {showShootingStyles && (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {shootingStyles.map((style) => {
                const count = getShootingStyleCount(style.id);
                const isActive = isShootingStyleActive(style.id);
                
                if (count === 0) return null;
                
                return (
                  <button
                    key={style.id}
                    onClick={() => onFilterChange({ type: 'shooting-style', styleId: style.id } as any)}
                    className={`w-full flex items-start gap-3 p-2.5 rounded-lg transition-all hover:bg-accent group ${
                      isActive ? 'bg-gradient-to-r from-purple-100 to-pink-100' : ''
                    }`}
                  >
                    <Icon 
                      name="Camera" 
                      size={18} 
                      className={isActive ? 'text-purple-600' : 'text-muted-foreground group-hover:text-primary'}
                    />
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm ${
                          isActive ? 'text-gray-900 font-semibold' : 'text-gray-700'
                        }`}>
                          {style.name}
                        </p>
                        <Badge variant="secondary" className="text-xs h-5 shrink-0">
                          {count}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsFilterSidebar;