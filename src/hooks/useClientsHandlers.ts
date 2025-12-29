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
  navigateToSettings?: () => void;
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
  navigateToSettings,
}: UseClientsHandlersProps) => {
  
  const handleAddClient = async () => {
    console.log('[CLIENT_ADD] userId:', userId, 'type:', typeof userId);
    
    if (!userId || userId === 'null' || userId === 'undefined') {
      console.error('[CLIENT_ADD] Invalid userId:', userId);
      toast.error('Не удалось определить пользователя', {
        description: 'Попробуйте перезагрузить страницу и войти заново'
      });
      return;
    }
    
    // Проверяем наличие города в профиле (мягкая проверка - не блокируем создание)
    let cityWarningShown = false;
    try {
      const settingsResponse = await fetch('https://functions.poehali.dev/8ce3cb93-2701-441d-aa3b-e9c0e99a9994', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        }
      });
      
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        
        // Если города нет - показываем предупреждение, но НЕ блокируем создание
        if (!settingsData.success || !settingsData.settings || !settingsData.settings.city || !settingsData.settings.region) {
          toast.warning('Рекомендуем указать ваш город в настройках', {
            description: 'Это поможет клиентам найти вас. Перейдите в Настройки → Профиль',
            duration: 5000,
            action: {
              label: 'Настройки',
              onClick: () => {
                sessionStorage.setItem('highlightLocation', 'true');
                if (navigateToSettings) {
                  navigateToSettings();
                } else {
                  window.location.hash = '#/webapp/settings';
                }
                setTimeout(() => {
                  const locationSection = document.querySelector('[data-location-section]');
                  if (locationSection) {
                    locationSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 300);
              }
            }
          });
          cityWarningShown = true;
        }
      }
    } catch (error) {
      console.error('[CLIENT_ADD] Failed to check city (non-critical):', error);
      // Не прерываем создание клиента при ошибке проверки города
    }
    
    // Сохраняем данные клиента до очистки формы
    // Если имя не указано - используем "Новый клиент"
    // Если телефон не указан - используем пустую строку (БД требует значение)
    const clientNameForSearch = newClient.name || 'Новый клиент';
    const clientPhoneForSearch = newClient.phone || '-';
    const savedClientData = { ...newClient }; // Сохраняем копию для восстановления
    
    // Закрываем форму и показываем счётчик СРАЗУ (не ждём сервер!)
    // НО НЕ очищаем форму - это будет сделано после определения дубликата/нового
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
          console.log('[CLIENT_ADD] Server response:', { createdClientId, isDuplicate, result });
        } catch (err) {
          console.error('[CLIENT_ADD] Failed to parse response:', err);
        }
        
        if (isDuplicate) {
          console.log('[CLIENT_ADD] Duplicate client detected, ID:', createdClientId);
          toast.info('Клиент с такими данными уже существует', {
            description: 'Открываю карточку существующего клиента'
          });
          // НЕ очищаем форму для дубликата - оставляем данные для пульсирующего индикатора
        } else {
          console.log('[CLIENT_ADD] New client created, ID:', createdClientId);
          toast.success('Клиент успешно добавлен');
          
          // Очищаем форму и localStorage ТОЛЬКО для новых клиентов
          setNewClient({ name: '', phone: '', email: '', address: '', vkProfile: '' });
          if (onClientCreated) {
            onClientCreated();
          }
        }
        
        // Обновить список клиентов и сразу открыть окно
        if (setIsDetailDialogOpen && setIsCountdownOpen) {
        
        // ПАРАЛЛЕЛЬНО формируем данные клиента (пока идёт счётчик)
        const dataPromise = (async () => {
          if (!createdClientId) {
            throw new Error('Client ID not returned from server');
          }
          
          // Если дубликат - загружаем свежий список и ищем клиента
          if (isDuplicate) {
            console.log('[CLIENT_ADD] Duplicate detected, loading fresh client list');
            
            // Загружаем обновлённый список клиентов напрямую из API
            const freshRes = await fetch(CLIENTS_API, {
              headers: { 'X-User-Id': userId }
            });
            
            if (!freshRes.ok) {
              throw new Error('Failed to load fresh client list');
            }
            
            const freshData = await freshRes.json();
            
            // Ищем клиента с нужным ID в свежих данных
            const existingClientRaw = freshData.find((c: any) => c.id === createdClientId);
            
            if (existingClientRaw) {
              console.log('[CLIENT_ADD] Found existing client:', existingClientRaw.id);
              
              // Парсим данные клиента в нужный формат
              const existingClient: Client = {
                id: existingClientRaw.id,
                name: existingClientRaw.name,
                phone: existingClientRaw.phone,
                email: existingClientRaw.email || '',
                address: existingClientRaw.address || '',
                vkProfile: existingClientRaw.vk_profile || '',
                bookings: (existingClientRaw.bookings || []).map((b: any) => ({
                  id: b.id,
                  date: new Date(b.booking_date),
                  booking_date: b.booking_date,
                  time: b.booking_time,
                  booking_time: b.booking_time,
                  title: b.title || '',
                  description: b.description || '',
                  notificationEnabled: b.notification_enabled,
                  notification_enabled: b.notification_enabled,
                  notificationTime: b.notification_time || 24,
                  notification_time: b.notification_time || 24,
                  clientId: b.client_id,
                  client_id: b.client_id
                })),
                projects: (existingClientRaw.projects || []).map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  status: p.status,
                  budget: parseFloat(p.budget) || 0,
                  startDate: p.start_date || p.startDate,
                  description: p.description || '',
                  shootingStyleId: p.shooting_style_id || p.shootingStyleId || undefined,
                  shooting_time: p.shooting_time,
                  shooting_duration: p.shooting_duration,
                  shooting_address: p.shooting_address,
                  add_to_calendar: p.add_to_calendar
                })),
                payments: (existingClientRaw.payments || []).map((pay: any) => ({
                  id: pay.id,
                  amount: parseFloat(pay.amount) || 0,
                  date: pay.payment_date || pay.date,
                  status: pay.status,
                  method: pay.method,
                  description: pay.description || '',
                  projectId: pay.project_id || pay.projectId
                })),
                documents: (existingClientRaw.documents || []).map((d: any) => ({
                  id: d.id,
                  name: d.name,
                  fileUrl: d.file_url,
                  uploadDate: d.upload_date
                })),
                comments: (existingClientRaw.comments || []).map((c: any) => ({
                  id: c.id,
                  author: c.author,
                  text: c.text,
                  date: c.comment_date || c.date
                })),
                messages: (existingClientRaw.messages || []).map((m: any) => ({
                  id: m.id,
                  type: m.type,
                  author: m.author,
                  content: m.content,
                  date: m.message_date || m.date
                }))
              };
              
              // Обновляем список клиентов в фоне
              loadClients();
              
              return existingClient;
            }
            
            throw new Error('Existing client not found in fresh data');
          }
          
          // Если новый клиент - формируем объект из данных формы и обновляем список
          console.log('[CLIENT_ADD] New client created, updating list');
          
          // Обновляем список клиентов в фоне
          loadClients();
          
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
          console.log('[CLIENT_ADD] Client data ready:', parsedClient.id, parsedClient.name);
          setSelectedClient(parsedClient);
          
          // Считаем сколько времени прошло
          const elapsedTime = Date.now() - startTime;
          console.log('[CLIENT_ADD] Data loaded in', elapsedTime, 'ms');
          
          // Показываем прогресс минимум 500мс для плавности
          const minDisplayTime = 500;
          if (elapsedTime < minDisplayTime) {
            await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsedTime));
          }
          
          // Если данные готовы раньше 30 секунд - открываем сразу
          if (elapsedTime < maxWaitTime) {
            console.log('[CLIENT_ADD] Opening detail dialog');
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
            console.log('[CLIENT_ADD] Opening detail dialog (after wait)');
            setIsDetailDialogOpen(true);
          }
        } catch (error) {
          console.error('[CLIENT_ADD] Error loading client data:', error);
          const elapsedTime = Date.now() - startTime;
          const remainingTime = maxWaitTime - elapsedTime;
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }
          setIsCountdownOpen(false);
          toast.error('Не удалось загрузить данные клиента', {
            description: 'Попробуйте обновить страницу'
          });
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