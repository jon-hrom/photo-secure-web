import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';
import ClientsHeader from '@/components/clients/ClientsHeader';
import ClientsListSection from '@/components/clients/ClientsListSection';
import ClientsCalendarSection from '@/components/clients/ClientsCalendarSection';
import BookingDialogs from '@/components/clients/BookingDialogs';
import MessageDialog from '@/components/clients/MessageDialog';
import ClientDetailDialog from '@/components/clients/ClientDetailDialog';
import { Client, Booking } from '@/components/clients/ClientsTypes';

interface ClientsPageProps {
  autoOpenClient?: string;
}

const ClientsPage = ({ autoOpenClient }: ClientsPageProps) => {
  const userId = localStorage.getItem('userId');
  const [emailVerified, setEmailVerified] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';
  
  // Загрузка клиентов из БД
  const loadClients = async () => {
    if (!userId) return;
    
    try {
      const res = await fetch(CLIENTS_API, {
        headers: { 'X-User-Id': userId }
      });
      
      if (!res.ok) throw new Error('Failed to load clients');
      
      const data = await res.json();
      const parsed = data.map((client: any) => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        address: client.address || '',
        vkProfile: client.vk_profile || '',
        bookings: (client.bookings || []).map((b: any) => ({
          id: b.id,
          date: new Date(b.booking_date),
          time: b.booking_time,
          description: b.description || '',
          notificationEnabled: b.notification_enabled,
          clientId: b.client_id
        })),
        projects: client.projects || [],
        payments: client.payments || [],
        documents: client.documents || [],
        comments: client.comments || [],
        messages: client.messages || []
      }));
      
      setClients(parsed);
      
      // Миграция данных из localStorage если есть
      const localData = localStorage.getItem(`clients_${userId}`);
      if (localData && parsed.length === 0) {
        try {
          const localClients = JSON.parse(localData);
          if (localClients.length > 0) {
            for (const client of localClients) {
              await fetch(CLIENTS_API, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Id': userId
                },
                body: JSON.stringify({
                  action: 'create',
                  name: client.name,
                  phone: client.phone,
                  email: client.email,
                  address: client.address,
                  vkProfile: client.vkProfile
                })
              });
            }
            localStorage.removeItem(`clients_${userId}`);
            await loadClients();
            toast.success('Данные перенесены в облако');
          }
        } catch (e) {
          console.error('Migration failed:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
      toast.error('Не удалось загрузить клиентов');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadClients();
  }, [userId]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [messageTab, setMessageTab] = useState<'vk' | 'email'>('vk');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    vkProfile: '',
  });

  const [newBooking, setNewBooking] = useState({
    time: '',
    description: '',
    notificationEnabled: true,
  });

  const [vkMessage, setVkMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
  ];

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.phone) {
      toast.error('Заполните обязательные поля');
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
          action: 'create',
          ...newClient
        })
      });
      
      if (!res.ok) throw new Error('Failed to add client');
      
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

  const allBookedDates = clients.flatMap(c => c.bookings.map(b => b.date));

  const openEditDialog = (client: Client) => {
    setEditingClient({ ...client });
    setIsEditDialogOpen(true);
  };

  const openBookingDialog = (client: Client) => {
    setSelectedClient(client);
    setIsBookingDialogOpen(true);
  };

  const openMessageDialog = (client: Client) => {
    setSelectedClient(client);
    setIsMessageDialogOpen(true);
  };

  const openDetailDialog = (client: Client) => {
    setSelectedClient(client);
    setIsDetailDialogOpen(true);
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

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.phone.includes(searchQuery) ||
                         client.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    
    const hasActiveBookings = client.bookings.some(b => b.date >= new Date());
    if (statusFilter === 'active') return matchesSearch && hasActiveBookings;
    if (statusFilter === 'inactive') return matchesSearch && !hasActiveBookings;
    
    return matchesSearch;
  });

  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!userId) return;
      try {
        const res = await fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`);
        const data = await res.json();
        setEmailVerified(!!data.email_verified_at);
      } catch (err) {
        console.error('Failed to check email verification:', err);
      }
    };
    
    checkEmailVerification();
    
    if (autoOpenClient) {
      const client = clients.find(c => c.name === autoOpenClient);
      if (client) {
        setSelectedClient(client);
        setIsDetailDialogOpen(true);
      } else {
        toast.info(`Клиент "${autoOpenClient}" не найден в базе`);
      }
    }
  }, [autoOpenClient, clients, userId]);

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
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        totalClients={clients.length}
        isAddDialogOpen={isAddDialogOpen}
        setIsAddDialogOpen={setIsAddDialogOpen}
        isEditDialogOpen={isEditDialogOpen}
        setIsEditDialogOpen={setIsEditDialogOpen}
        newClient={newClient}
        setNewClient={setNewClient}
        editingClient={editingClient}
        setEditingClient={setEditingClient}
        handleAddClient={handleAddClient}
        handleUpdateClient={handleUpdateClientFromEdit}
        emailVerified={emailVerified}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ClientsListSection
          filteredClients={filteredClients}
          onSelectClient={openDetailDialog}
          onEditClient={openEditDialog}
          onDeleteClient={handleDeleteClient}
          onAddBooking={openBookingDialog}
        />

        <ClientsCalendarSection
          selectedDate={selectedDate}
          allBookedDates={allBookedDates}
          onDateClick={handleDateClick}
          selectedClient={selectedClient}
          onMessageClient={openMessageDialog}
          clients={clients}
        />
      </div>

      <BookingDialogs
        isBookingDialogOpen={isBookingDialogOpen}
        setIsBookingDialogOpen={setIsBookingDialogOpen}
        isBookingDetailsOpen={isBookingDetailsOpen}
        setIsBookingDetailsOpen={setIsBookingDetailsOpen}
        selectedClient={selectedClient}
        selectedBooking={selectedBooking}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        newBooking={newBooking}
        setNewBooking={setNewBooking}
        timeSlots={timeSlots}
        handleAddBooking={handleAddBooking}
        handleDeleteBooking={handleDeleteBooking}
        clients={clients}
      />

      <ClientDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        client={selectedClient}
        onUpdate={handleUpdateClient}
      />

      <MessageDialog
        isOpen={isMessageDialogOpen}
        setIsOpen={setIsMessageDialogOpen}
        selectedClient={selectedClient}
        messageTab={messageTab}
        setMessageTab={setMessageTab}
        vkMessage={vkMessage}
        setVkMessage={setVkMessage}
        emailSubject={emailSubject}
        setEmailSubject={setEmailSubject}
        emailBody={emailBody}
        setEmailBody={setEmailBody}
        handleSearchVK={handleSearchVK}
        handleSendVKMessage={handleSendVKMessage}
        handleSendEmail={handleSendEmail}
      />
    </div>
  );
};

export default ClientsPage;