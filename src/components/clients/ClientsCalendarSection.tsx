import { Client } from '@/components/clients/ClientsTypes';
import CalendarStatsCards from './calendar/CalendarStatsCards';
import InteractiveCalendar from './calendar/InteractiveCalendar';
import TodayBookingsList from './calendar/TodayBookingsList';
import UpcomingBookingsList from './calendar/UpcomingBookingsList';
import { useRef } from 'react';

interface ClientsCalendarSectionProps {
  selectedDate: Date | undefined;
  allBookedDates: Date[];
  onDateClick: (date: Date | undefined) => void;
  selectedClient: Client | null;
  onMessageClient: (client: Client) => void;
  onBookingClick: (client: Client, booking: any) => void;
  clients: Client[];
}

const ClientsCalendarSection = ({
  selectedDate,
  allBookedDates,
  onDateClick,
  selectedClient,
  onMessageClient,
  onBookingClick,
  clients,
}: ClientsCalendarSectionProps) => {
  const upcomingListRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let upcomingBookings = clients
    .flatMap(c => c.bookings.map(b => ({ ...b, client: c })))
    .filter(b => b.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Если выбрана дата - фильтруем только бронирования на эту дату
  if (selectedDate) {
    const selectedDateNormalized = new Date(selectedDate);
    selectedDateNormalized.setHours(0, 0, 0, 0);
    
    upcomingBookings = upcomingBookings.filter(b => {
      const bookingDate = new Date(b.date);
      bookingDate.setHours(0, 0, 0, 0);
      return bookingDate.getTime() === selectedDateNormalized.getTime();
    });
  } else {
    upcomingBookings = upcomingBookings.slice(0, 8);
  }

  const todayBookings = clients
    .flatMap(c => c.bookings.map(b => ({ ...b, client: c })))
    .filter(b => {
      const bookingDate = new Date(b.date);
      bookingDate.setHours(0, 0, 0, 0);
      return bookingDate.getTime() === today.getTime();
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const getBookingStats = () => {
    const total = upcomingBookings.length;
    const thisWeek = upcomingBookings.filter(b => {
      const bookingDate = new Date(b.date);
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      return bookingDate <= weekFromNow;
    }).length;
    return { total, thisWeek };
  };

  const stats = getBookingStats();

  return (
    <div className="space-y-6">
      <CalendarStatsCards thisWeek={stats.thisWeek} total={stats.total} />
      
      <InteractiveCalendar
        selectedDate={selectedDate}
        allBookedDates={allBookedDates}
        onDateClick={(date) => {
          if (!date) {
            onDateClick(date);
            return;
          }

          // Нормализуем дату
          const clickedDate = new Date(date);
          clickedDate.setHours(0, 0, 0, 0);
          
          // Ищем бронирования на эту дату
          const bookingsOnDate = clients.flatMap(c => 
            (c.bookings || [])
              .filter(b => {
                const bookingDate = new Date(b.booking_date || b.date);
                bookingDate.setHours(0, 0, 0, 0);
                return bookingDate.getTime() === clickedDate.getTime();
              })
              .map(b => ({ ...b, client: c }))
          );

          // Если одно бронирование - сразу открываем детали
          if (bookingsOnDate.length === 1) {
            const booking = bookingsOnDate[0];
            onBookingClick(booking.client, booking);
          } else if (bookingsOnDate.length > 1) {
            // Если несколько - показываем список
            onDateClick(date);
            setTimeout(() => {
              upcomingListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          } else {
            // Если нет - просто выбираем дату
            onDateClick(date);
          }
        }}
        today={today}
      />

      <TodayBookingsList todayBookings={todayBookings} />

      <div ref={upcomingListRef}>
        <UpcomingBookingsList
          upcomingBookings={upcomingBookings}
          selectedClient={selectedClient}
          onMessageClient={onMessageClient}
          selectedDate={selectedDate}
          onClearFilter={() => onDateClick(undefined)}
          onBookingClick={(booking) => onBookingClick(booking.client, booking)}
        />
      </div>
    </div>
  );
};

export default ClientsCalendarSection;