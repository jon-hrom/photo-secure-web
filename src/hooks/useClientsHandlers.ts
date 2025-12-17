import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';
import { validatePhone } from '@/utils/phoneFormat';

interface UseClientsHandlersProps {
  userId: string | null;
  CLIENTS_API: string;
  loadClients: () => Promise<void>;
  clients: Client[];
  setClients: (clients: Client[]) => void;
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
  setIsCountdownOpen?: (open: boolean) => void;
}

export const useClientsHandlers = ({
  userId,
  CLIENTS_API,
  loadClients,
  clients,
  setClients,
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
  setIsCountdownOpen,
}: UseClientsHandlersProps) => {
  
  const handleAddClient = async () => {
    if (!newClient.name || !newClient.phone) {
      toast.error('Заполните обязательные поля');
      return;
    }
    
    if (!userId) {
      toast.error('Не удалось определить пользователя');
      return;
    }
    
    // Сохраняем данные клиента до очистки формы
    const clientNameForSearch = newClient.name;
    const clientPhoneForSearch = newClient.phone;
    
    // Закрываем форму и показываем счётчик СРАЗУ (не ждём сервер!)
    setNewClient({ name: '', phone: '', email: '', address: '', vkProfile: '' });
    setIsAddDialogOpen(false);
    
    if (setIsDetailDialogOpen && setIsCountdownOpen) {
      setIsCountdownOpen(true);
    }
    
    // ВСЁ ОСТАЛЬНОЕ в фоне (не блокирует UI)
    (async () => {
      try {
        const res = await fetch(CLIENTS_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          },
          body: JSON.stringify({
            action: 'create',
            name: clientNameForSearch,
            phone: clientPhoneForSearch,
            email: newClient.email,
            address: newClient.address,
            vkProfile: newClient.vkProfile
          })
        });
        
        if (!res.ok) {
          throw new Error('Failed to add client');
        }
        
        let createdClientId: number | null = null;
        
        try {
          const result = await res.json();
          createdClientId = result?.id || null;
        } catch (err) {
          console.error('[CLIENT_ADD] No JSON response');
        }
        
        toast.success('Клиент успешно добавлен');
        
        // Обновить список клиентов и сразу открыть окно
        if (setIsDetailDialogOpen && setIsCountdownOpen) {
        
        // ПАРАЛЛЕЛЬНО формируем данные клиента (пока идёт счётчик)
        const dataPromise = (async () => {
          // Используем данные из ответа сервера напрямую - не делаем лишние запросы
          
          if (!createdClientId) {
            throw new Error('Client ID not returned from server');
          }
          
          // Формируем объект клиента из уже имеющихся данных
          return {
            id: createdClientId,
            name: clientNameForSearch,
            phone: clientPhoneForSearch,
            email: newClient.email || '',
            address: newClient.address || '',
            vkProfile: newClient.vkProfile || '',
            bookings: [],
            projects: [],
            payments: [],
            documents: [],
            comments: [],
            messages: []
          } as Client;
        })();
        
        // Запускаем таймер и загрузку данных параллельно
        const startTime = Date.now();
        const maxWaitTime = 30000; // 30 секунд
        
        try {
          // Формируем данные клиента
          const parsedClient = await dataPromise;
          setSelectedClient(parsedClient);
          
          // Считаем сколько времени прошло
          const elapsedTime = Date.now() - startTime;
          
          // Показываем прогресс минимум 500мс для плавности
          const minDisplayTime = 500;
          if (elapsedTime < minDisplayTime) {
            await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsedTime));
          }
          
          // Если данные готовы раньше 30 секунд - открываем сразу
          if (elapsedTime < maxWaitTime) {
            setIsCountdownOpen(false);
            setTimeout(() => {
              setIsDetailDialogOpen(true);
            }, 100);
          } else {
            // Если что-то пошло не так - ждём окончания countdown
            const remainingTime = maxWaitTime - elapsedTime;
            if (remainingTime > 0) {
              await new Promise(resolve => setTimeout(resolve, remainingTime));
            }
            setIsDetailDialogOpen(true);
          }
        } catch (error) {
          console.error('[CLIENT_ADD] Error:', error);
          const elapsedTime = Date.now() - startTime;
          const remainingTime = maxWaitTime - elapsedTime;
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }
          setIsCountdownOpen(false);
          toast.error('Не удалось загрузить данные клиента');
        }
        
        // Обновляем список клиентов ОДИН РАЗ в конце
        await loadClients();
      } else {
        // Если нет setIsDetailDialogOpen - просто обновляем список
        await loadClients();
      }
    } catch (error) {
      console.error('Failed to add client:', error);
      if (setIsCountdownOpen) {
        setIsCountdownOpen(false);
      }
      toast.error('Не удалось добавить клиента');
    }
    })();
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
      
      setIsEditDialogOpen(false);
      setEditingClient(null);
      
      // Обновляем список в фоне
      loadClients().catch(console.error);
      
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
      
      setSelectedClient(null);
      
      // Обновляем список в фоне
      loadClients().catch(console.error);
      
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
      
      const result = await res.json();
      
      // Локально добавляем бронирование к клиенту - не перезагружаем всех клиентов
      if (selectedClient && result.id) {
        const newBookingObj = {
          id: result.id,
          date: new Date(dateString),
          booking_date: dateString,
          time: newBooking.time,
          booking_time: newBooking.time,
          title: '',
          description: newBooking.description,
          notificationEnabled: newBooking.notificationEnabled,
          notificationTime: newBooking.notificationTime,
          clientId: selectedClient.id
        };
        
        setSelectedClient({
          ...selectedClient,
          bookings: [...(selectedClient.bookings || []), newBookingObj]
        });
      }
      
      setNewBooking({ time: '', description: '', notificationEnabled: true, notificationTime: 24 });
      setSelectedDate(undefined);
      setIsBookingDialogOpen(false);
      
      // Обновляем список в фоне
      loadClients().catch(console.error);
      
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
      
      // Локально удаляем бронирование - не перезагружаем всех клиентов
      if (selectedClient) {
        setSelectedClient({
          ...selectedClient,
          bookings: selectedClient.bookings.filter(b => b.id !== bookingId)
        });
      }
      
      setIsBookingDetailsOpen(false);
      setSelectedBooking(null);
      
      // Обновляем список в фоне
      loadClients().catch(console.error);
      
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
    try {
      const res = await fetch(CLIENTS_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId!
        },
        body: JSON.stringify(updatedClient)
      });
      
      if (!res.ok) {
        throw new Error('Failed to update client');
      }
      
      // Сначала обновляем локально для мгновенной реакции UI
      setSelectedClient(updatedClient);
      
      // Затем перезагружаем список клиентов из сервера
      await loadClients().catch(console.error);
      
      toast.success('Данные клиента обновлены');
    } catch (error) {
      console.error('Failed to update client:', error);
      toast.error('Не удалось обновить данные');
    }
  };

  const handleDeleteMultipleClients = async (clientIds: number[]) => {
    if (!userId) {
      toast.error('Не удалось определить пользователя');
      throw new Error('No userId');
    }

    if (clientIds.length === 0) {
      return;
    }

    try {
      // Удаляем клиентов параллельно
      const deletePromises = clientIds.map(clientId =>
        fetch(CLIENTS_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          },
          body: JSON.stringify({
            action: 'delete',
            clientId
          })
        })
      );

      const results = await Promise.all(deletePromises);
      
      const failedCount = results.filter(res => !res.ok).length;
      const successfulIds = clientIds.filter((_, index) => results[index].ok);
      
      // Мгновенно удаляем из UI
      if (successfulIds.length > 0) {
        setClients(clients.filter(c => !successfulIds.includes(c.id)));
      }
      
      if (failedCount > 0) {
        toast.error(`Не удалось удалить ${failedCount} из ${clientIds.length} клиентов`);
      } else {
        toast.success(`Успешно удалено ${clientIds.length} клиент(ов)`);
      }

      setSelectedClient(null);
      
      // Обновляем список в фоне (на случай изменений с других устройств)
      loadClients().catch(console.error);
    } catch (error) {
      console.error('Delete multiple clients error:', error);
      toast.error('Ошибка при удалении клиентов');
      throw error;
    }
  };

  return {
    handleAddClient,
    handleUpdateClientFromEdit,
    handleDeleteClient,
    handleDeleteMultipleClients,
    handleAddBooking,
    handleDeleteBooking,
    handleDateClick,
    handleSearchVK,
    handleSendVKMessage,
    handleSendEmail,
    handleUpdateClient,
  };
};