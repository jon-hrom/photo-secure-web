import { Client } from '@/components/clients/ClientsTypes';
import CalendarStatsCards from './calendar/CalendarStatsCards';
import InteractiveCalendar from './calendar/InteractiveCalendar';
import TodayBookingsList from './calendar/TodayBookingsList';
import UpcomingBookingsList from './calendar/UpcomingBookingsList';

interface ClientsCalendarSectionProps {
  selectedDate: Date | undefined;
  allBookedDates: Date[];
  onDateClick: (date: Date | undefined) => void;
  onDateLongPress: (date: Date | undefined) => void;
  selectedClient: Client | null;
  onMessageClient: (client: Client) => void;
  clients: Client[];
}

const ClientsCalendarSection = ({
  selectedDate,
  allBookedDates,
  onDateClick,
  onDateLongPress,
  selectedClient,
  onMessageClient,
  clients,
}: ClientsCalendarSectionProps) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingBookings = clients
    .flatMap(c => c.bookings.map(b => ({ ...b, client: c })))
    .filter(b => b.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 8);

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
        onDateClick={onDateClick}
        onDateLongPress={onDateLongPress}
        today={today}
      />

      <TodayBookingsList todayBookings={todayBookings} />

      <UpcomingBookingsList
        upcomingBookings={upcomingBookings}
        selectedClient={selectedClient}
        onMessageClient={onMessageClient}
      />
    </div>
  );
};

export default ClientsCalendarSection;
