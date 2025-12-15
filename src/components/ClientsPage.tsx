import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';
import ClientsHeader from '@/components/clients/ClientsHeader';
import ClientsListSection from '@/components/clients/ClientsListSection';
import ClientsTableView from '@/components/clients/ClientsTableView';
import ClientsCalendarSection from '@/components/clients/ClientsCalendarSection';
import ClientsFilterSidebar, { FilterType } from '@/components/clients/ClientsFilterSidebar';
import BookingDialogs from '@/components/clients/BookingDialogs';
import MessageDialog from '@/components/clients/MessageDialog';
import ClientDetailDialog from '@/components/clients/ClientDetailDialog';
import ClientsExportDialog from '@/components/clients/ClientsExportDialog';
import LoadingProgressBar from '@/components/clients/LoadingProgressBar';
import { useClientsData } from '@/hooks/useClientsData';
import { useClientsDialogs } from '@/hooks/useClientsDialogs';
import { useClientsHandlers } from '@/hooks/useClientsHandlers';
import { useNavigationHistory } from '@/hooks/useNavigationHistory';
import { Client } from '@/components/clients/ClientsTypes';

interface ClientsPageProps {
  autoOpenClient?: string;
  autoOpenAddDialog?: boolean;
  onAddDialogClose?: () => void;
  userId?: string | null;
}

const ClientsPage = ({ autoOpenClient, autoOpenAddDialog, onAddDialogClose, userId: propUserId }: ClientsPageProps) => {
  const userId = propUserId || localStorage.getItem('userId');
  const [activeFilter, setActiveFilter] = useState<FilterType>('active-projects');
  
  // Хук для работы с данными
  const { clients, loading, emailVerified, loadClients, CLIENTS_API } = useClientsData(userId);
  
  // Хук для управления диалогами и состоянием
  const dialogsState = useClientsDialogs();
  
  // Открываем диалог добавления клиента при autoOpenAddDialog
  useEffect(() => {
    if (autoOpenAddDialog) {
      dialogsState.setIsAddDialogOpen(true);
      if (onAddDialogClose) {
        onAddDialogClose();
      }
    }
  }, [autoOpenAddDialog, onAddDialogClose]);
  
  // Хук для навигации
  const navigation = useNavigationHistory();
  
  // Хук для обработчиков событий
  const handlers = useClientsHandlers({
    userId,
    CLIENTS_API,
    loadClients,
    clients,
    selectedClient: dialogsState.selectedClient,
    setSelectedClient: dialogsState.setSelectedClient,
    selectedDate: dialogsState.selectedDate,
    newClient: dialogsState.newClient,
    setNewClient: dialogsState.setNewClient,
    setIsAddDialogOpen: dialogsState.setIsAddDialogOpen,
    editingClient: dialogsState.editingClient,
    setEditingClient: dialogsState.setEditingClient,
    setIsEditDialogOpen: dialogsState.setIsEditDialogOpen,
    newBooking: dialogsState.newBooking,
    setNewBooking: dialogsState.setNewBooking,
    setSelectedDate: dialogsState.setSelectedDate,
    setIsBookingDialogOpen: dialogsState.setIsBookingDialogOpen,
    setIsBookingDetailsOpen: dialogsState.setIsBookingDetailsOpen,
    setSelectedBooking: dialogsState.setSelectedBooking,
    setVkMessage: dialogsState.setVkMessage,
    emailSubject: dialogsState.emailSubject,
    setEmailSubject: dialogsState.setEmailSubject,
    emailBody: dialogsState.emailBody,
    setEmailBody: dialogsState.setEmailBody,
    setIsDetailDialogOpen: dialogsState.setIsDetailDialogOpen,
    setIsCountdownOpen: dialogsState.setIsCountdownOpen,
  });

  // Фильтрация клиентов по поиску
  const searchFilteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(dialogsState.searchQuery.toLowerCase()) ||
                         client.phone.includes(dialogsState.searchQuery) ||
                         client.email.toLowerCase().includes(dialogsState.searchQuery.toLowerCase());
    
    if (dialogsState.statusFilter === 'all') return matchesSearch;
    
    // Проверяем есть ли активные проекты (не "завершён" и не "отменён")
    const hasActiveProjects = (client.projects || []).some(p => p.status !== 'completed' && p.status !== 'cancelled');
    // Проверяем будущие бронирования
    const hasActiveBookings = (client.bookings || []).some(b => {
      const bookingDate = new Date(b.booking_date || b.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return bookingDate >= today;
    });
    const isActive = hasActiveProjects || hasActiveBookings;
    
    if (dialogsState.statusFilter === 'active') return matchesSearch && isActive;
    if (dialogsState.statusFilter === 'inactive') return matchesSearch && !isActive;
    
    return matchesSearch;
  });

  // Применение фильтров из боковой панели
  const applyAdvancedFilter = (clientsList: Client[]): Client[] => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Проверка фильтра по стилю съёмки
    if (typeof activeFilter === 'object' && activeFilter.type === 'shooting-style') {
      console.log('🔍 Фильтр по стилю:', activeFilter.styleId);
      const filtered = clientsList.filter(c =>
        (c.projects || []).some(p => p.shootingStyleId === activeFilter.styleId)
      );
      console.log('📊 Результат фильтрации:', filtered.length, 'из', clientsList.length);
      return filtered;
    }

    switch (activeFilter) {
      case 'all':
        return clientsList;
      
      case 'active-projects':
        return clientsList.filter(c => 
          (c.projects || []).some(p => p.status !== 'completed' && p.status !== 'cancelled')
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

  // Все забронированные даты
  const allBookedDates = clients.flatMap(c => c.bookings.map(b => b.date));

  // Автооткрытие клиента при передаче autoOpenClient
  useEffect(() => {
    if (autoOpenClient) {
      const client = clients.find(c => c.name === autoOpenClient);
      if (client) {
        dialogsState.setSelectedClient(client);
        dialogsState.setIsDetailDialogOpen(true);
      } else {
        toast.info(`Клиент "${autoOpenClient}" не найден в базе`);
      }
    }
  }, [autoOpenClient, clients]);

  // Сохранение состояния при изменениях
  useEffect(() => {
    if (clients.length > 0) {
      navigation.pushState({
        viewMode: dialogsState.viewMode,
        searchQuery: dialogsState.searchQuery,
        statusFilter: dialogsState.statusFilter,
        selectedClientId: dialogsState.selectedClient?.id,
      });
    }
  }, [dialogsState.viewMode, dialogsState.searchQuery, dialogsState.statusFilter, dialogsState.selectedClient?.id, clients.length, navigation]);

  // Обработчики навигации
  const handleGoBack = useCallback(() => {
    const prevState = navigation.goBack();
    if (prevState) {
      dialogsState.setViewMode(prevState.viewMode);
      dialogsState.setSearchQuery(prevState.searchQuery);
      dialogsState.setStatusFilter(prevState.statusFilter);
      if (prevState.selectedClientId) {
        const client = clients.find(c => c.id === prevState.selectedClientId);
        if (client) {
          dialogsState.setSelectedClient(client);
        }
      }
    }
  }, [navigation, dialogsState, clients]);

  const handleGoForward = useCallback(() => {
    const nextState = navigation.goForward();
    if (nextState) {
      dialogsState.setViewMode(nextState.viewMode);
      dialogsState.setSearchQuery(nextState.searchQuery);
      dialogsState.setStatusFilter(nextState.statusFilter);
      if (nextState.selectedClientId) {
        const client = clients.find(c => c.id === nextState.selectedClientId);
        if (client) {
          dialogsState.setSelectedClient(client);
        }
      }
    }
  }, [navigation, dialogsState, clients]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {!emailVerified && (
        <Alert className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <Icon name="AlertCircle" className="text-amber-600" />
          <AlertDescription className="ml-2">
            <span className="font-semibold text-amber-900">Подтвердите email для полного доступа.</span>{' '}
            <span className="text-amber-700">Некоторые функции (создание клиентов, бронирования) могут быть ограничены.</span>
          </AlertDescription>
        </Alert>
      )}
      
      <ClientsHeader
        searchQuery={dialogsState.searchQuery}
        setSearchQuery={dialogsState.setSearchQuery}
        statusFilter={dialogsState.statusFilter}
        setStatusFilter={dialogsState.setStatusFilter}
        totalClients={clients.length}
        isAddDialogOpen={dialogsState.isAddDialogOpen}
        setIsAddDialogOpen={dialogsState.setIsAddDialogOpen}
        isEditDialogOpen={dialogsState.isEditDialogOpen}
        setIsEditDialogOpen={dialogsState.setIsEditDialogOpen}
        newClient={dialogsState.newClient}
        setNewClient={dialogsState.setNewClient}
        editingClient={dialogsState.editingClient}
        setEditingClient={dialogsState.setEditingClient}
        handleAddClient={handlers.handleAddClient}
        handleUpdateClient={handlers.handleUpdateClientFromEdit}
        emailVerified={emailVerified}
        viewMode={dialogsState.viewMode}
        setViewMode={dialogsState.setViewMode}
        onExportClick={() => dialogsState.setIsExportDialogOpen(true)}
        canGoBack={navigation.canGoBack}
        canGoForward={navigation.canGoForward}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        clients={clients}
      />

      {dialogsState.viewMode === 'table' ? (
        <ClientsTableView
          clients={clients}
          onSelectClient={dialogsState.openDetailDialog}
          onDeleteClients={handlers.handleDeleteMultipleClients}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr] xl:grid-cols-[minmax(240px,280px)_minmax(400px,1fr)_minmax(300px,380px)] gap-4 lg:gap-6">
          <div className="xl:order-1">
            <ClientsFilterSidebar
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              clients={clients}
            />
          </div>

          <div className="xl:order-2">
            <ClientsListSection
              filteredClients={filteredClients}
              onSelectClient={dialogsState.openDetailDialog}
              onEditClient={dialogsState.openEditDialog}
              onDeleteClient={handlers.handleDeleteClient}
              onAddBooking={dialogsState.openBookingDialog}
            />
          </div>

          <div className="xl:order-3 hidden xl:block">
            <ClientsCalendarSection
              selectedDate={dialogsState.selectedDate}
              allBookedDates={allBookedDates}
              onDateClick={handlers.handleDateClick}
              selectedClient={dialogsState.selectedClient}
              onMessageClient={dialogsState.openMessageDialog}
              clients={clients}
            />
          </div>
        </div>
      )}

      <BookingDialogs
        isBookingDialogOpen={dialogsState.isBookingDialogOpen}
        setIsBookingDialogOpen={dialogsState.setIsBookingDialogOpen}
        isBookingDetailsOpen={dialogsState.isBookingDetailsOpen}
        setIsBookingDetailsOpen={dialogsState.setIsBookingDetailsOpen}
        selectedClient={dialogsState.selectedClient}
        selectedBooking={dialogsState.selectedBooking}
        selectedDate={dialogsState.selectedDate}
        setSelectedDate={dialogsState.setSelectedDate}
        newBooking={dialogsState.newBooking}
        setNewBooking={dialogsState.setNewBooking}
        timeSlots={dialogsState.timeSlots}
        allBookedDates={allBookedDates}
        handleDateClick={handlers.handleDateClick}
        handleAddBooking={handlers.handleAddBooking}
        handleDeleteBooking={handlers.handleDeleteBooking}
        clients={clients}
      />

      <ClientDetailDialog
        open={dialogsState.isDetailDialogOpen}
        onOpenChange={dialogsState.setIsDetailDialogOpen}
        client={dialogsState.selectedClient}
        onUpdate={handlers.handleUpdateClient}
      />

      <MessageDialog
        isOpen={dialogsState.isMessageDialogOpen}
        setIsOpen={dialogsState.setIsMessageDialogOpen}
        selectedClient={dialogsState.selectedClient}
        messageTab={dialogsState.messageTab}
        setMessageTab={dialogsState.setMessageTab}
        vkMessage={dialogsState.vkMessage}
        setVkMessage={dialogsState.setVkMessage}
        emailSubject={dialogsState.emailSubject}
        setEmailSubject={dialogsState.setEmailSubject}
        emailBody={dialogsState.emailBody}
        setEmailBody={dialogsState.setEmailBody}
        handleSearchVK={handlers.handleSearchVK}
        handleSendVKMessage={handlers.handleSendVKMessage}
        handleSendEmail={handlers.handleSendEmail}
      />

      <ClientsExportDialog
        open={dialogsState.isExportDialogOpen}
        onOpenChange={dialogsState.setIsExportDialogOpen}
        clients={clients}
        filteredClients={filteredClients}
      />

      <LoadingProgressBar
        open={dialogsState.isCountdownOpen}
        maxTime={30000}
        onComplete={() => dialogsState.setIsCountdownOpen(false)}
      />
    </div>
  );
};

export default ClientsPage;