import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import UnsavedDataDialog from '@/components/clients/UnsavedDataDialog';
import UnsavedProjectDialog from '@/components/clients/UnsavedProjectDialog';
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
  clients?: Client[];
  onClientsUpdate?: (clients: Client[]) => void;
}

const ClientsPage = ({ autoOpenClient, autoOpenAddDialog, onAddDialogClose, userId: propUserId, clients: propClients, onClientsUpdate }: ClientsPageProps) => {
  const userId = propUserId || localStorage.getItem('userId');
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // Хук для работы с данными
  const { clients, setClients, loading, emailVerified, loadClients, CLIENTS_API } = useClientsData(userId, propClients, onClientsUpdate);
  
  // Хук для управления диалогами и состоянием
  const dialogsState = useClientsDialogs(userId, clients);
  
  // Открываем диалог добавления клиента при autoOpenAddDialog
  useEffect(() => {
    if (autoOpenAddDialog) {
      dialogsState.setIsAddDialogOpen(true);
      if (onAddDialogClose) {
        onAddDialogClose();
      }
    }
  }, [autoOpenAddDialog, onAddDialogClose]);

  // Уведомление о статусе email при загрузке страницы
  useEffect(() => {
    if (!loading && userId) {
      const hasSeenEmailNotification = sessionStorage.getItem(`email_status_notification_seen_${userId}`);
      
      if (!hasSeenEmailNotification) {
        const googleUser = localStorage.getItem('google_user');
        
        if (googleUser) {
          setTimeout(() => {
            toast.success('Ваша почта подтверждена автоматически', {
              description: 'Вы вошли через Google — email подтверждён',
              duration: 5000,
            });
          }, 500);
          sessionStorage.setItem(`email_status_notification_seen_${userId}`, 'true');
        } else if (!emailVerified) {
          setTimeout(() => {
            toast.warning('Подтвердите вашу почту', {
              description: 'Для полного доступа к функциям подтвердите email в настройках',
              duration: 8000,
              action: {
                label: 'Настройки',
                onClick: () => navigate('/settings')
              }
            });
          }, 500);
          sessionStorage.setItem(`email_status_notification_seen_${userId}`, 'true');
        }
      }
    }
  }, [loading, userId, emailVerified, navigate]);

  // Проверка несохранённых данных при загрузке страницы
  useEffect(() => {
    if (!loading && clients.length > 0 && userId) {
      const hasSeenUnsavedNotification = sessionStorage.getItem(`unsaved_notification_seen_${userId}`);
      
      if (!hasSeenUnsavedNotification) {
        const savedClient = dialogsState.loadClientData();
        const { hasUnsaved, clientId } = dialogsState.hasAnyUnsavedProject ? dialogsState.hasAnyUnsavedProject() : { hasUnsaved: false, clientId: null };
        const { hasOpen, clientId: openCardClientId, clientName: openCardClientName } = dialogsState.hasAnyOpenCard();
        
        if (savedClient && (savedClient.name || savedClient.phone || savedClient.email)) {
          setTimeout(() => {
            toast.info('У вас есть несохранённые данные клиента', {
              description: 'Нажмите на кнопку "Добавить клиента" чтобы продолжить',
              duration: 8000,
              action: {
                label: 'Продолжить',
                onClick: () => dialogsState.handleOpenAddDialog()
              }
            });
          }, 1000);
          sessionStorage.setItem(`unsaved_notification_seen_${userId}`, 'true');
        } else if (hasOpen && openCardClientId && openCardClientName) {
          setTimeout(() => {
            toast.info(`У вас незавершённая работа с ${openCardClientName}`, {
              description: 'Карточка клиента была закрыта без добавления проекта',
              duration: 8000,
              action: {
                label: 'Продолжить',
                onClick: () => {
                  const client = clients.find(c => c.id === openCardClientId);
                  if (client) {
                    dialogsState.handleOpenClientWithProjectCheck(client);
                  }
                }
              }
            });
          }, 1000);
          sessionStorage.setItem(`unsaved_notification_seen_${userId}`, 'true');
        } else if (hasUnsaved && clientId) {
          setTimeout(() => {
            const client = clients.find(c => c.id === clientId);
            const clientName = client ? client.name : 'клиента';
            toast.info(`У вас есть несохранённый проект для ${clientName}`, {
              description: 'Нажмите на кнопку "Добавить клиента" чтобы продолжить',
              duration: 8000,
              action: {
                label: 'Продолжить',
                onClick: () => dialogsState.handleOpenAddDialog()
              }
            });
          }, 1000);
          sessionStorage.setItem(`unsaved_notification_seen_${userId}`, 'true');
        }
      }
    }
  }, [loading, clients, userId, dialogsState]);
  
  // Хук для навигации
  const navigation = useNavigationHistory();
  
  // Хук для обработчиков событий
  const handlers = useClientsHandlers({
    userId,
    CLIENTS_API,
    loadClients,
    clients,
    setClients,
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
    onClientCreated: dialogsState.handleClientCreated,
    navigateToSettings: () => navigate('/settings'),
    saveOpenCardData: dialogsState.saveOpenCardData,
  });

  // Фильтрация клиентов по поиску
  const searchFilteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(dialogsState.searchQuery.toLowerCase()) ||
                         client.phone.includes(dialogsState.searchQuery) ||
                         client.email.toLowerCase().includes(dialogsState.searchQuery.toLowerCase());
    
    if (dialogsState.statusFilter === 'all') return matchesSearch;
    
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
        handleOpenAddDialog={dialogsState.handleOpenAddDialog}
        hasUnsavedData={dialogsState.hasUnsavedClientData()}
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
        clients={searchFilteredClients}
        userId={userId}
      />

      {dialogsState.viewMode === 'table' ? (
        <ClientsTableView
          clients={filteredClients}
          onSelectClient={dialogsState.handleOpenClientWithProjectCheck}
          onDeleteClients={handlers.handleDeleteMultipleClients}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr] xl:grid-cols-[minmax(240px,280px)_minmax(400px,1fr)_minmax(300px,380px)] gap-4 lg:gap-6">
          <div className="xl:order-1">
            <ClientsFilterSidebar
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              clients={searchFilteredClients}
            />
          </div>

          <div className="xl:order-2">
            <ClientsListSection
              filteredClients={filteredClients}
              onSelectClient={dialogsState.handleOpenClientWithProjectCheck}
              onEditClient={dialogsState.openEditDialog}
              onDeleteClient={handlers.handleDeleteClient}
              onAddBooking={dialogsState.openBookingDialog}
              userId={userId}
              isDetailDialogOpen={dialogsState.isDetailDialogOpen}
              selectedClientId={dialogsState.selectedClient?.id || null}
            />
          </div>

          <div className="xl:order-3 hidden xl:block">
            <ClientsCalendarSection
              selectedDate={dialogsState.selectedDate}
              allBookedDates={allBookedDates}
              onDateClick={dialogsState.setSelectedDate}
              selectedClient={dialogsState.selectedClient}
              onMessageClient={dialogsState.openMessageDialog}
              onBookingClick={(client, booking) => {
                dialogsState.setSelectedClient(client);
                dialogsState.setSelectedBooking(booking);
                dialogsState.setIsBookingDetailsOpen(true);
              }}
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

      <UnsavedDataDialog
        open={dialogsState.isUnsavedDataDialogOpen}
        onContinue={dialogsState.handleContinueWithSavedData}
        onClear={dialogsState.handleClearSavedData}
        onCancel={() => dialogsState.setIsUnsavedDataDialogOpen(false)}
        clientData={dialogsState.loadClientData()}
      />

      {dialogsState.unsavedProjectClientId && (
        <UnsavedProjectDialog
          open={dialogsState.isUnsavedProjectDialogOpen}
          onContinue={dialogsState.handleContinueWithSavedProject}
          onClear={dialogsState.handleClearSavedProject}
          onCancel={() => dialogsState.setIsUnsavedProjectDialogOpen(false)}
          projectData={dialogsState.loadProjectData(dialogsState.unsavedProjectClientId)}
        />
      )}
    </div>
  );
};

export default ClientsPage;