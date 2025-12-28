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
  onClientCreated?: () => void;
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
  onClientCreated,
}: UseClientsHandlersProps) => {
  
  const handleAddClient = async () => {
    if (!userId) {
      toast.error('Не удалось определить пользователя');
      return;
    }
    
    // Проверяем наличие города в профиле
    try {
      const settingsResponse = await fetch('https://functions.poehali.dev/e2a76d38-8e20-40b0-a7c4-b4d62d18fccb', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        }
      });
      
      if (!settingsResponse.ok) {
        console.error('[CLIENT_ADD] Settings API error:', settingsResponse.status);
        toast.error('Не удалось проверить настройки', {
          description: 'Попробуйте ещё раз или перезагрузите страницу'
        });
        return;
      }
      
      const settingsData = await settingsResponse.json();
      console.log('[CLIENT_ADD] Settings check:', { 
        success: settingsData.success, 
        hasSettings: !!settingsData.settings,
        city: settingsData.settings?.city,
        region: settingsData.settings?.region
      });
      
      if (!settingsData.success || !settingsData.settings || !settingsData.settings.city || !settingsData.settings.region) {
        toast.error('Укажите ваш город в настройках', {
          description: 'Перейдите в Настройки → Профиль → выберите Область и Город',
          duration: 6000,
          action: {
            label: 'Открыть настройки',
            onClick: () => {
              window.location.hash = '#/webapp/settings';
            }
          }
        });
        setIsAddDialogOpen(false);
        return;
      }
    } catch (error) {
      console.error('[CLIENT_ADD] Failed to check city:', error);
      toast.error('Ошибка сети', {
        description: 'Проверьте подключение к интернету и попробуйте снова'
      });
      return;
    }
    
    // Сохраняем данные клиента до очистки формы
    // Если имя не указано - используем "Новый клиент"
    // Если телефон не указан - используем пустую строку (БД требует значение)
    const clientNameForSearch = newClient.name || 'Новый клиент';
    const clientPhoneForSearch = newClient.phone || '-';
    
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
        
        if (!res.ok && res.status !== 200) {
          throw new Error('Failed to add client');
        }
        
        let createdClientId: number | null = null;
        let isDuplicate = false;
        
        try {
          const result = await res.json();
          createdClientId = result?.id || null;
          isDuplicate = result?.duplicate || false;
        } catch (err) {
          console.error('[CLIENT_ADD] No JSON response');
        }
        
        if (isDuplicate) {
          toast.info('Клиент с такими данными уже существует', {
            description: 'Открываю карточку существующего клиента'
          });
        } else {
          toast.success('Клиент успешно добавлен');
        }
        
        // Очищаем сохранённые данные после успешного создания
        if (onClientCreated) {
          onClientCreated();
        }
        
        // Обновить список клиентов и сразу открыть окно
        if (setIsDetailDialogOpen && setIsCountdownOpen) {
        
        // ПАРАЛЛЕЛЬНО формируем данные клиента (пока идёт счётчик)
        const dataPromise = (async () => {
          if (!createdClientId) {
            throw new Error('Client ID not returned from server');
          }
          
          // Если дубликат - загружаем полные данные существующего клиента из списка
          if (isDuplicate) {
            await loadClients(); // Обновляем список клиентов
            const existingClient = clients.find(c => c.id === createdClientId);
            if (existingClient) {
              return existingClient;
            }
          }
          
          // Если новый клиент - формируем объект из данных формы
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
    handleSearchVK,
    handleSendVKMessage,
    handleSendEmail,
    handleUpdateClient,
  };
};