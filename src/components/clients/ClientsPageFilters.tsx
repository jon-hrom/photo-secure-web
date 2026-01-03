import { Client } from '@/components/clients/ClientsTypes';
import { FilterType } from '@/components/clients/ClientsFilterSidebar';

interface FilterResult {
  searchFilteredClients: Client[];
  filteredClients: Client[];
  allBookedDates: Date[];
}

interface UseClientsFiltersProps {
  clients: Client[];
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'inactive';
  activeFilter: FilterType;
}

export const useClientsFilters = ({
  clients,
  searchQuery,
  statusFilter,
  activeFilter,
}: UseClientsFiltersProps): FilterResult => {
  
  // Фильтрация клиентов по поиску
  const searchFilteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.phone.includes(searchQuery) ||
                         client.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    
    // Проверяем есть ли активные проекты (не "завершён" и не "отменён" и не "завершить")
    const hasActiveProjects = (client.projects || []).some(p => p.status !== 'completed' && p.status !== 'cancelled' && p.status !== 'finalize');
    
    // Проверяем будущие бронирования
    const hasActiveBookings = (client.bookings || []).some(b => {
      const bookingDate = new Date(b.booking_date || b.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return bookingDate >= today;
    });
    const isActive = hasActiveProjects || hasActiveBookings;
    
    if (statusFilter === 'active') return matchesSearch && isActive;
    if (statusFilter === 'inactive') return matchesSearch && !isActive;
    
    return matchesSearch;
  });

  // Применение фильтров из боковой панели
  const applyAdvancedFilter = (clientsList: Client[]): Client[] => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Проверка фильтра по стилю съёмки
    if (typeof activeFilter === 'object' && activeFilter.type === 'shooting-style') {
      return clientsList.filter(c =>
        (c.projects || []).some(p => p.shootingStyleId === activeFilter.styleId)
      );
    }

    switch (activeFilter) {
      case 'all':
        return clientsList;
      
      case 'active-projects':
        return clientsList.filter(c => 
          (c.projects || []).some(p => p.status !== 'completed' && p.status !== 'cancelled' && p.status !== 'finalize')
        );
      
      case 'upcoming-meetings':
        return clientsList.filter(c =>
          (c.bookings || []).some(b => {
            const bookingDate = new Date(b.booking_date || b.date);
            return bookingDate >= now;
          })
        );
      
      case 'new-clients':
        return clientsList.filter(c => {
          if (!c.created_at) return false;
          const createdDate = new Date(c.created_at);
          return createdDate >= sevenDaysAgo;
        });
      
      case 'alphabetical':
        return [...clientsList].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      
      case 'most-projects':
        return [...clientsList].sort((a, b) => 
          (b.projects?.length || 0) - (a.projects?.length || 0)
        );
      
      default:
        return clientsList;
    }
  };

  const filteredClients = applyAdvancedFilter(searchFilteredClients);

  // Все забронированные даты (бронирования + даты начала проектов)
  const allBookedDates = [
    ...clients.flatMap(c => c.bookings.map(b => {
      const date = new Date(b.booking_date || b.date);
      date.setHours(0, 0, 0, 0);
      return date;
    })),
    ...clients.flatMap(c => 
      (c.projects || [])
        .filter(p => p.startDate && p.status !== 'cancelled')
        .map(p => {
          const date = new Date(p.startDate);
          date.setHours(0, 0, 0, 0);
          return date;
        })
    )
  ];

  return {
    searchFilteredClients,
    filteredClients,
    allBookedDates,
  };
};
