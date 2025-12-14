import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';
import { validatePhone } from '@/utils/phoneFormat';

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
  setIsDetailDialogOpen?: (open: boolean) => void;
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
  setIsDetailDialogOpen,
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
      
      let createdClientId: number | null = null;
      
      try {
        const result = await res.json();
        console.log('[CLIENT_ADD] Created client result:', result);
        createdClientId = result?.id || null;
      } catch (err) {
        console.log('[CLIENT_ADD] No JSON response, will find client by name');
      }
      
      setNewClient({ name: '', phone: '', email: '', address: '', vkProfile: '' });
      setIsAddDialogOpen(false);
      toast.success('Клиент успешно добавлен');
      
      // Обновить список клиентов и сразу открыть окно
      if (setIsDetailDialogOpen) {
        console.log('[CLIENT_ADD] Fetching fresh client data...');
        const freshRes = await fetch(CLIENTS_API, {
          headers: { 'X-User-Id': userId! }
        });
        
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          console.log('[CLIENT_ADD] Fresh data length:', freshData.length);
          
          // Ищем по ID или по имени + телефону (последний добавленный)
          const addedClient = createdClientId 
            ? freshData.find((c: any) => c.id === createdClientId)
            : freshData
                .filter((c: any) => c.name === newClient.name && c.phone === newClient.phone)
                .sort((a: any, b: any) => b.id - a.id)[0];
          
          console.log('[CLIENT_ADD] Found added client:', !!addedClient);
          
          if (addedClient) {
            // Парсим данные клиента в нужный формат
            const parsedClient: Client = {
              id: addedClient.id,
              name: addedClient.name,
              phone: addedClient.phone,
              email: addedClient.email || '',
              address: addedClient.address || '',
              vkProfile: addedClient.vk_profile || '',
              bookings: (addedClient.bookings || []).map((b: any) => ({
                id: b.id,
                date: new Date(b.booking_date),
                booking_date: b.booking_date,
                time: b.booking_time,
                booking_time: b.booking_time,
                title: b.title || '',
                description: b.description || '',
                notificationEnabled: b.notification_enabled,
                notificationTime: b.notification_time || 24,
                clientId: b.client_id
              })),
              projects: (addedClient.projects || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                status: p.status,
                budget: parseFloat(p.budget) || 0,
                startDate: p.start_date,
                description: p.description || ''
              })),
              payments: (addedClient.payments || []).map((pay: any) => ({
                id: pay.id,
                amount: parseFloat(pay.amount) || 0,
                date: pay.payment_date,
                status: pay.status,
                method: pay.method,
                description: pay.description || '',
                projectId: pay.project_id
              })),
              documents: (addedClient.documents || []).map((d: any) => ({
                id: d.id,
                name: d.name,
                fileUrl: d.file_url,
                uploadDate: d.upload_date
              })),
              comments: [],
              messages: []
            };
            
            console.log('[CLIENT_ADD] Opening client detail dialog');
            setSelectedClient(parsedClient);
            setIsDetailDialogOpen(true);
          }
        }
        
        // Обновляем список клиентов в фоне
        await loadClients();
      } else {
        // Если нет setIsDetailDialogOpen - просто обновляем список
        await loadClients();
      }
    } catch (error) {
      console.error('Failed to add client:', error);
      toast.error('Не удалось добавить клиента');
    }
  };

  const handleUpdateClientFromEdit = async () => {
    if (!editingClient) return;
    
    if (!validatePhone(editingClient.phone)) {
      toast.error('Телефон должен содержать 11 цифр (включая +7)');
      return;
    }
    
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
    
    // Форматируем дату в YYYY-MM-DD без учёта часового пояса
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
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
          date: dateString,
          time: newBooking.time,
          description: newBooking.description,
          notificationEnabled: newBooking.notificationEnabled,
          notificationTime: newBooking.notificationTime
        })
      });
      
      if (!res.ok) throw new Error('Failed to add booking');
      
      await loadClients();
      setNewBooking({ time: '', description: '', notificationEnabled: true, notificationTime: 24 });
      setSelectedDate(undefined);
      setIsBookingDialogOpen(false);
      
      if (newBooking.notificationEnabled) {
        const timeText = newBooking.notificationTime >= 24 
          ? `${newBooking.notificationTime / 24} ${newBooking.notificationTime === 24 ? 'день' : newBooking.notificationTime === 48 ? 'дня' : 'недель'}`
          : `${newBooking.notificationTime} ${newBooking.notificationTime === 1 ? 'час' : newBooking.notificationTime <= 4 ? 'часа' : 'часов'}`;
        toast.success(`Бронирование создано! Уведомление будет отправлено за ${timeText} до встречи`);
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
    
    // Нормализуем дату для корректного сравнения
    const clickedDate = new Date(date);
    clickedDate.setHours(0, 0, 0, 0);
    
    // Ищем все бронирования на выбранную дату
    const bookingsOnDate = clients.flatMap(c => 
      (c.bookings || [])
        .filter(b => {
          const bookingDate = new Date(b.booking_date || b.date);
          bookingDate.setHours(0, 0, 0, 0);
          return bookingDate.getTime() === clickedDate.getTime();
        })
        .map(b => ({ ...b, client: c, clientId: c.id }))
    );

    console.log('[DATE_CLICK] Clicked date:', clickedDate);
    console.log('[DATE_CLICK] Found bookings:', bookingsOnDate);

    if (bookingsOnDate.length > 0) {
      // Если есть бронирования на эту дату - открываем детали первого
      const bookingWithClient = bookingsOnDate[0];
      const client = clients.find(c => c.id === bookingWithClient.clientId);
      
      console.log('[DATE_CLICK] Opening booking details for client:', client?.name);
      
      if (client) {
        setSelectedClient(client);
        setSelectedBooking(bookingWithClient);
        setIsBookingDetailsOpen(true);
      }
    } else {
      // Если нет бронирований - просто выбираем дату для нового бронирования
      console.log('[DATE_CLICK] No bookings, setting selected date');
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
    console.log('[useClientsHandlers] handleUpdateClient called with:', updatedClient);
    console.log('[useClientsHandlers] Payments in updated client:', updatedClient.payments);
    console.log('[useClientsHandlers] Projects in updated client:', updatedClient.projects);
    
    try {
      const res = await fetch(CLIENTS_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId!
        },
        body: JSON.stringify(updatedClient)
      });
      
      console.log('[useClientsHandlers] Update response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[useClientsHandlers] Update failed:', errorText);
        throw new Error('Failed to update client');
      }
      
      // Перезагружаем всех клиентов из БД
      await loadClients();
      
      // Загружаем свежие данные конкретного клиента с сервера
      const freshClientRes = await fetch(`${CLIENTS_API}?userId=${userId}`, {
        headers: { 'X-User-Id': userId! }
      });
      
      if (freshClientRes.ok) {
        const allClients = await freshClientRes.json();
        const refreshedClient = allClients.find((c: Client) => c.id === updatedClient.id);
        if (refreshedClient) {
          console.log('[useClientsHandlers] Refreshed client from server:', refreshedClient);
          console.log('[useClientsHandlers] Refreshed payments:', refreshedClient.payments);
          console.log('[useClientsHandlers] Refreshed projects:', refreshedClient.projects);
          setSelectedClient(refreshedClient);
        }
      }
      
      toast.success('Данные клиента обновлены');
    } catch (error) {
      console.error('[useClientsHandlers] Failed to update client:', error);
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