import { Client } from '@/components/clients/ClientsTypes';
import InteractiveCalendar from './calendar/InteractiveCalendar';
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
    .flatMap(c => c.bookings.map(b => {
      const bookingDate = new Date(b.booking_date || b.date);
      bookingDate.setHours(0, 0, 0, 0);
      return { ...b, client: c, normalizedDate: bookingDate };
    }))
    .filter(b => b.normalizedDate >= today)
    .sort((a, b) => a.normalizedDate.getTime() - b.normalizedDate.getTime());

  // Если выбрана дата - фильтруем только бронирования на эту дату
  if (selectedDate) {
    const selectedDateNormalized = new Date(selectedDate);
    selectedDateNormalized.setHours(0, 0, 0, 0);
    
    upcomingBookings = upcomingBookings.filter(b => 
      b.normalizedDate.getTime() === selectedDateNormalized.getTime()
    );
  } else {
    upcomingBookings = upcomingBookings.slice(0, 8);
  }

  return (
    <div className="space-y-6">
      <InteractiveCalendar
        selectedDate={selectedDate}
        allBookedDates={allBookedDates}
        onDateClick={(date) => {
          onDateClick(date);
          if (date) {
            setTimeout(() => {
              upcomingListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        }}
        today={today}
        clients={clients}
        onBookingClick={onBookingClick}
      />

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