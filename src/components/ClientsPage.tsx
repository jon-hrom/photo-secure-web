import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { ClientsPageEffects } from '@/components/clients/ClientsPageEffects';
import { useClientsFilters } from '@/components/clients/ClientsPageFilters';
import { useClientsPageNavigation } from '@/components/clients/ClientsPageNavigation';
import { useClientsData } from '@/hooks/useClientsData';
import { useClientsDialogs } from '@/hooks/useClientsDialogs';
import { useClientsHandlers } from '@/hooks/useClientsHandlers';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Обработка URL параметра filter=no-date
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'no-date') {
      setActiveFilter('no-date');
      // Очищаем параметр из URL после применения
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);
  
  // Хук для работы с данными
  const { clients, setClients, loading, emailVerified, loadClients, CLIENTS_API } = useClientsData(userId, propClients, onClientsUpdate);
  
  // Хук для управления диалогами и состоянием
  const dialogsState = useClientsDialogs(userId, clients);
  
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

  // Фильтрация клиентов
  const { searchFilteredClients, filteredClients, allBookedDates, allBookingsWithTime } = useClientsFilters({
    clients,
    searchQuery: dialogsState.searchQuery,
    statusFilter: dialogsState.statusFilter,
    activeFilter,
  });

  // Навигация (back/forward)
  const { canGoBack, canGoForward, handleGoBack, handleGoForward } = useClientsPageNavigation({
    viewMode: dialogsState.viewMode,
    searchQuery: dialogsState.searchQuery,
    statusFilter: dialogsState.statusFilter,
    selectedClient: dialogsState.selectedClient,
    clients,
    setViewMode: dialogsState.setViewMode,
    setSearchQuery: dialogsState.setSearchQuery,
    setStatusFilter: dialogsState.setStatusFilter,
    setSelectedClient: dialogsState.setSelectedClient,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ClientsPageEffects
        loading={loading}
        userId={userId}
        emailVerified={emailVerified}
        clients={clients}
        autoOpenAddDialog={autoOpenAddDialog}
        autoOpenClient={autoOpenClient}
        onAddDialogClose={onAddDialogClose}
        setIsAddDialogOpen={dialogsState.setIsAddDialogOpen}
        setSelectedClient={dialogsState.setSelectedClient}
        setIsDetailDialogOpen={dialogsState.setIsDetailDialogOpen}
        loadClientData={dialogsState.loadClientData}
        hasAnyUnsavedProject={dialogsState.hasAnyUnsavedProject}
        hasAnyOpenCard={dialogsState.hasAnyOpenCard}
        handleOpenAddDialog={dialogsState.handleOpenAddDialog}
        handleOpenClientWithProjectCheck={dialogsState.handleOpenClientWithProjectCheck}
      />

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
        canGoBack={canGoBack}
        canGoForward={canGoForward}
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
              allBookingsWithTime={allBookingsWithTime}
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