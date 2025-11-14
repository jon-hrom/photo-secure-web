import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import ClientCard from '@/components/clients/ClientCard';
import ClientDialogs from '@/components/clients/ClientDialogs';
import BookingDialogs from '@/components/clients/BookingDialogs';
import MessageDialog from '@/components/clients/MessageDialog';

interface Booking {
  id: number;
  date: Date;
  time: string;
  description: string;
  notificationEnabled: boolean;
  clientId: number;
}

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  vkProfile?: string;
  bookings: Booking[];
}

const ClientsPage = () => {
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
    },
  ]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [messageTab, setMessageTab] = useState<'vk' | 'email'>('vk');

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

  const handleUpdateClient = () => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Система учёта клиентов</h2>
        <ClientDialogs
          isAddDialogOpen={isAddDialogOpen}
          setIsAddDialogOpen={setIsAddDialogOpen}
          isEditDialogOpen={isEditDialogOpen}
          setIsEditDialogOpen={setIsEditDialogOpen}
          newClient={newClient}
          setNewClient={setNewClient}
          editingClient={editingClient}
          setEditingClient={setEditingClient}
          handleAddClient={handleAddClient}
          handleUpdateClient={handleUpdateClient}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {clients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onSelect={() => openMessageDialog(client)}
              onEdit={() => openEditDialog(client)}
              onDelete={() => handleDeleteClient(client.id)}
              onAddBooking={() => openBookingDialog(client)}
            />
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Calendar" className="text-primary" />
                Календарь бронирований
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateClick}
                modifiers={{
                  booked: allBookedDates,
                }}
                modifiersStyles={{
                  booked: {
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'white',
                    fontWeight: 'bold',
                  },
                }}
                className="rounded-md border"
              />
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded bg-primary"></div>
                  <span>Забронированные даты</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="TrendingUp" className="text-primary" />
                Статистика
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Всего клиентов</span>
                <Badge variant="secondary">{clients.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Активных броней</span>
                <Badge variant="default">
                  {clients.reduce((acc, c) => acc + c.bookings.filter(b => b.date >= new Date()).length, 0)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Завершённых броней</span>
                <Badge variant="outline">
                  {clients.reduce((acc, c) => acc + c.bookings.filter(b => b.date < new Date()).length, 0)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
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
        allBookedDates={allBookedDates}
        handleDateClick={handleDateClick}
        handleAddBooking={handleAddBooking}
        handleDeleteBooking={handleDeleteBooking}
        clients={clients}
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
