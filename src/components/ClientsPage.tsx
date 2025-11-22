import { useEffect } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';
import ClientsHeader from '@/components/clients/ClientsHeader';
import ClientsListSection from '@/components/clients/ClientsListSection';
import ClientsCalendarSection from '@/components/clients/ClientsCalendarSection';
import BookingDialogs from '@/components/clients/BookingDialogs';
import MessageDialog from '@/components/clients/MessageDialog';
import ClientDetailDialog from '@/components/clients/ClientDetailDialog';
import { useClientsData } from '@/hooks/useClientsData';
import { useClientsDialogs } from '@/hooks/useClientsDialogs';
import { useClientsHandlers } from '@/hooks/useClientsHandlers';

interface ClientsPageProps {
  autoOpenClient?: string;
}

const ClientsPage = ({ autoOpenClient }: ClientsPageProps) => {
  const userId = localStorage.getItem('userId');
  
  // Хук для работы с данными
  const { clients, loading, emailVerified, loadClients, CLIENTS_API } = useClientsData(userId);
  
  // Хук для управления диалогами и состоянием
  const dialogsState = useClientsDialogs();
  
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
    setEmailSubject: dialogsState.setEmailSubject,
    setEmailBody: dialogsState.setEmailBody,
  });

  // Фильтрация клиентов
  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(dialogsState.searchQuery.toLowerCase()) ||
                         client.phone.includes(dialogsState.searchQuery) ||
                         client.email.toLowerCase().includes(dialogsState.searchQuery.toLowerCase());
    
    if (dialogsState.statusFilter === 'all') return matchesSearch;
    
    const hasActiveBookings = client.bookings.some(b => b.date >= new Date());
    if (dialogsState.statusFilter === 'active') return matchesSearch && hasActiveBookings;
    if (dialogsState.statusFilter === 'inactive') return matchesSearch && !hasActiveBookings;
    
    return matchesSearch;
  });

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
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ClientsListSection
          filteredClients={filteredClients}
          onSelectClient={dialogsState.openDetailDialog}
          onEditClient={dialogsState.openEditDialog}
          onDeleteClient={handlers.handleDeleteClient}
          onAddBooking={dialogsState.openBookingDialog}
        />

        <ClientsCalendarSection
          selectedDate={dialogsState.selectedDate}
          allBookedDates={allBookedDates}
          onDateClick={handlers.handleDateClick}
          selectedClient={dialogsState.selectedClient}
          onMessageClient={dialogsState.openMessageDialog}
          clients={clients}
        />
      </div>

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
    </div>
  );
};

export default ClientsPage;
