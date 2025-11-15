import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
  const [clients, setClients] = useState<Client[]>([
    {
      id: 1,
      name: 'Иванова Мария Петровна',
      phone: '+7 (999) 123-45-67',
      email: 'maria@mail.ru',
      address: 'г. Москва, ул. Ленина, д. 10',
      vkProfile: 'mariaivanova',
      bookings: [
        {
          id: 1,
          date: new Date(2025, 10, 15),
          time: '14:00',
          description: 'Свадебная фотосессия в студии',
          notificationEnabled: true,
          clientId: 1,
        },
      ],
      projects: [
        {
          id: 1,
          name: 'Свадебная фотосессия',
          status: 'in_progress',
          budget: 80000,
          startDate: new Date(2025, 9, 1).toISOString(),
          description: 'Съёмка свадебного дня, включая утро невесты, церемонию и банкет',
        },
      ],
      payments: [
        {
          id: 1,
          amount: 40000,
          date: new Date(2025, 9, 1).toISOString(),
          status: 'completed',
          method: 'card',
          description: 'Предоплата 50%',
        },
        {
          id: 2,
          amount: 40000,
          date: new Date(2025, 10, 15).toISOString(),
          status: 'pending',
          method: 'card',
          description: 'Окончательный расчёт',
        },
      ],
      comments: [
        {
          id: 1,
          date: new Date(2025, 9, 1).toISOString(),
          author: 'Администратор',
          text: 'Клиент очень ответственный, внесла предоплату сразу после консультации',
        },
      ],
      messages: [
        {
          id: 1,
          date: new Date(2025, 9, 1).toISOString(),
          type: 'email',
          content: 'Отправлено коммерческое предложение на свадебную съёмку',
          author: 'Администратор',
        },
      ],
    },
    {
      id: 2,
      name: 'Петров Сергей Иванович',
      phone: '+7 (999) 987-65-43',
      email: 'sergey@mail.ru',
      address: 'г. Москва, ул. Пушкина, д. 5',
      vkProfile: 'sergey_petrov',
      bookings: [
        {
          id: 2,
          date: new Date(2025, 10, 16),
          time: '16:30',
          description: 'Консультация по выбору пакета услуг',
          notificationEnabled: true,
          clientId: 2,
        },
      ],
      projects: [
        {
          id: 2,
          name: 'Корпоративная фотосъёмка',
          status: 'new',
          budget: 50000,
          startDate: new Date(2025, 10, 10).toISOString(),
          description: 'Фотосъёмка команды для корпоративного сайта',
        },
      ],
      payments: [],
      comments: [],
      messages: [],
    },
  ]);

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

  const handleAddClient = () => {
    if (!newClient.name || !newClient.phone) {
      toast.error('Заполните обязательные поля');
      return;
    }
    const client: Client = {
      id: Date.now(),
      ...newClient,
      bookings: [],
    };
    setClients([...clients, client]);
    setNewClient({ name: '', phone: '', email: '', address: '', vkProfile: '' });
    setIsAddDialogOpen(false);
    toast.success('Клиент успешно добавлен');
  };

  const handleUpdateClientFromEdit = () => {
    if (!editingClient) return;
    setClients(clients.map(c => c.id === editingClient.id ? editingClient : c));
    setIsEditDialogOpen(false);
    setEditingClient(null);
    toast.success('Данные клиента обновлены');
  };

  const handleDeleteClient = (clientId: number) => {
    setClients(clients.filter(c => c.id !== clientId));
    setSelectedClient(null);
    toast.success('Клиент удалён');
  };

  const handleAddBooking = () => {
    if (!selectedClient || !selectedDate || !newBooking.time) {
      toast.error('Заполните все поля');
      return;
    }
    const booking: Booking = {
      id: Date.now(),
      date: selectedDate,
      time: newBooking.time,
      description: newBooking.description,
      notificationEnabled: newBooking.notificationEnabled,
      clientId: selectedClient.id,
    };
    
    setClients(clients.map(c => 
      c.id === selectedClient.id 
        ? { ...c, bookings: [...c.bookings, booking] }
        : c
    ));
    
    setNewBooking({ time: '', description: '', notificationEnabled: true });
    setSelectedDate(undefined);
    setIsBookingDialogOpen(false);
    
    if (booking.notificationEnabled) {
      toast.success('Бронирование создано! Уведомление будет отправлено за 1 день до встречи');
    } else {
      toast.success('Бронирование создано');
    }
  };

  const handleDeleteBooking = (bookingId: number) => {
    setClients(clients.map(c => ({
      ...c,
      bookings: c.bookings.filter(b => b.id !== bookingId)
    })));
    setIsBookingDetailsOpen(false);
    setSelectedBooking(null);
    toast.success('Бронирование удалено');
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

  const handleUpdateClient = (updatedClient: Client) => {
    setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
    toast.success('Данные клиента обновлены');
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
    if (autoOpenClient) {
      const client = clients.find(c => c.name === autoOpenClient);
      if (client) {
        setSelectedClient(client);
        setIsDetailDialogOpen(true);
      } else {
        toast.info(`Клиент "${autoOpenClient}" не найден в базе`);
      }
    }
  }, [autoOpenClient, clients]);

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6 pt-24 md:pt-8">
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