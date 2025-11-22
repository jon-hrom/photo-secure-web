import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';

interface UseClientsHandlersProps {
  userId: string | null;
  CLIENTS_API: string;
  loadClients: () => Promise<void>;
  clients: Client[];
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  selectedDate: Date | undefined;
  newClient: {
    name: string;
    phone: string;
    email: string;
    address: string;
    vkProfile: string;
  };
  setNewClient: (client: any) => void;
  setIsAddDialogOpen: (open: boolean) => void;
  editingClient: Client | null;
  setEditingClient: (client: Client | null) => void;
  setIsEditDialogOpen: (open: boolean) => void;
  newBooking: {
    time: string;
    description: string;
    notificationEnabled: boolean;
  };
  setNewBooking: (booking: any) => void;
  setSelectedDate: (date: Date | undefined) => void;
  setIsBookingDialogOpen: (open: boolean) => void;
  setIsBookingDetailsOpen: (open: boolean) => void;
  setSelectedBooking: (booking: any) => void;
  setVkMessage: (message: string) => void;
  emailSubject: string;
  setEmailSubject: (subject: string) => void;
  emailBody: string;
  setEmailBody: (body: string) => void;
}

export const useClientsHandlers = ({
  userId,
  CLIENTS_API,
  loadClients,
  clients,
  selectedClient,
  setSelectedClient,
  selectedDate,
  newClient,
  setNewClient,
  setIsAddDialogOpen,
  editingClient,
  setEditingClient,
  setIsEditDialogOpen,
  newBooking,
  setNewBooking,
  setSelectedDate,
  setIsBookingDialogOpen,
  setIsBookingDetailsOpen,
  setSelectedBooking,
  setVkMessage,
  emailSubject,
  setEmailSubject,
  emailBody,
  setEmailBody,
}: UseClientsHandlersProps) => {
  
  const handleAddClient = async () => {
    console.log('[CLIENT_ADD] Function called');
    console.log('[CLIENT_ADD] newClient:', newClient);
    console.log('[CLIENT_ADD] userId:', userId);
    
    if (!newClient.name || !newClient.phone) {
      console.log('[CLIENT_ADD] Validation failed - missing name or phone');
      toast.error('Заполните обязательные поля');
      return;
    }
    
    if (!userId) {
      console.log('[CLIENT_ADD] No userId - aborting');
      toast.error('Не удалось определить пользователя');
      return;
    }
    
    try {
      console.log('[CLIENT_ADD] Sending request:', { action: 'create', ...newClient });
      console.log('[CLIENT_ADD] User ID:', userId);
      
      const res = await fetch(CLIENTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'create',
          ...newClient
        })
      });
      
      console.log('[CLIENT_ADD] Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[CLIENT_ADD] Error response:', errorText);
        throw new Error('Failed to add client');
      }
      
      await loadClients();
      setNewClient({ name: '', phone: '', email: '', address: '', vkProfile: '' });
      setIsAddDialogOpen(false);
      toast.success('Клиент успешно добавлен');
    } catch (error) {
      console.error('Failed to add client:', error);
      toast.error('Не удалось добавить клиента');
    }
  };

  const handleUpdateClientFromEdit = async () => {
    if (!editingClient) return;
    
    try {
      const res = await fetch(CLIENTS_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId!
        },
        body: JSON.stringify(editingClient)
      });
      
      if (!res.ok) throw new Error('Failed to update client');
      
      await loadClients();
      setIsEditDialogOpen(false);
      setEditingClient(null);
      toast.success('Данные клиента обновлены');
    } catch (error) {
      console.error('Failed to update client:', error);
      toast.error('Не удалось обновить данные');
    }
  };

  const handleDeleteClient = async (clientId: number) => {
    try {
      const res = await fetch(`${CLIENTS_API}?clientId=${clientId}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId! }
      });
      
      if (!res.ok) throw new Error('Failed to delete client');
      
      await loadClients();
      setSelectedClient(null);
      toast.success('Клиент удалён');
    } catch (error) {
      console.error('Failed to delete client:', error);
      toast.error('Не удалось удалить клиента');
    }
  };

  const handleAddBooking = async () => {
    if (!selectedClient || !selectedDate || !newBooking.time) {
      toast.error('Заполните все поля');
      return;
    }
    
    try {
      const res = await fetch(CLIENTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId!
        },
        body: JSON.stringify({
          action: 'add_booking',
          clientId: selectedClient.id,
          date: selectedDate.toISOString(),
          time: newBooking.time,
          description: newBooking.description,
          notificationEnabled: newBooking.notificationEnabled
        })
      });
      
      if (!res.ok) throw new Error('Failed to add booking');
      
      await loadClients();
      setNewBooking({ time: '', description: '', notificationEnabled: true });
      setSelectedDate(undefined);
      setIsBookingDialogOpen(false);
      
      if (newBooking.notificationEnabled) {
        toast.success('Бронирование создано! Уведомление будет отправлено за 1 день до встречи');
      } else {
        toast.success('Бронирование создано');
      }
    } catch (error) {
      console.error('Failed to add booking:', error);
      toast.error('Не удалось создать бронирование');
    }
  };

  const handleDeleteBooking = async (bookingId: number) => {
    try {
      const res = await fetch(`${CLIENTS_API}?action=delete_booking&bookingId=${bookingId}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId! }
      });
      
      if (!res.ok) throw new Error('Failed to delete booking');
      
      await loadClients();
      setIsBookingDetailsOpen(false);
      setSelectedBooking(null);
      toast.success('Бронирование удалено');
    } catch (error) {
      console.error('Failed to delete booking:', error);
      toast.error('Не удалось удалить бронирование');
    }
  };

  const handleDateClick = (date: Date | undefined) => {
    if (!date) return;
    
    const bookingsOnDate = clients.flatMap(c => 
      c.bookings
        .filter(b => b.date.toDateString() === date.toDateString())
        .map(b => ({ ...b, client: c }))
    );

    if (bookingsOnDate.length > 0) {
      const booking = bookingsOnDate[0];
      const client = clients.find(c => c.id === booking.clientId);
      if (client) {
        setSelectedClient(client);
        setSelectedBooking(booking);
        setIsBookingDetailsOpen(true);
      }
    } else {
      setSelectedDate(date);
    }
  };

  const handleSearchVK = () => {
    if (!selectedClient) return;
    const searchQuery = selectedClient.vkProfile || encodeURIComponent(selectedClient.name);
    window.open(`https://vk.com/${searchQuery}`, '_blank');
    toast.success('Поиск во ВКонтакте открыт в новой вкладке');
  };

  const handleSendVKMessage = () => {
    if (!selectedClient?.vkProfile) {
      toast.error('У клиента не указан профиль ВКонтакте');
      return;
    }
    window.open(`https://vk.com/im?sel=${selectedClient.vkProfile}`, '_blank');
    toast.success('Открыто окно сообщений ВКонтакте');
    setVkMessage('');
  };

  const handleSendEmail = () => {
    if (!selectedClient?.email) {
      toast.error('У клиента не указан email');
      return;
    }
    const mailtoLink = `mailto:${selectedClient.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;
    toast.success('Открыт почтовый клиент');
    setEmailSubject('');
    setEmailBody('');
  };

  const handleUpdateClient = async (updatedClient: Client) => {
    try {
      const res = await fetch(CLIENTS_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId!
        },
        body: JSON.stringify(updatedClient)
      });
      
      if (!res.ok) throw new Error('Failed to update client');
      
      await loadClients();
      toast.success('Данные клиента обновлены');
    } catch (error) {
      console.error('Failed to update client:', error);
      toast.error('Не удалось обновить данные');
    }
  };

  return {
    handleAddClient,
    handleUpdateClientFromEdit,
    handleDeleteClient,
    handleAddBooking,
    handleDeleteBooking,
    handleDateClick,
    handleSearchVK,
    handleSendVKMessage,
    handleSendEmail,
    handleUpdateClient,
  };
};