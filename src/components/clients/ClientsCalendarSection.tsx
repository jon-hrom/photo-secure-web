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

  return (
    <div className="space-y-6">
      <InteractiveCalendar
        selectedDate={selectedDate}
        allBookedDates={allBookedDates}
        onDateClick={(date) => {
          if (!date) {
            onDateClick(date);
            return;
          }

          const clickedDate = new Date(date);
          clickedDate.setHours(0, 0, 0, 0);
          
          const bookingsOnDate = clients.flatMap(c => 
            (c.bookings || [])
              .filter(b => {
                const bookingDate = new Date(b.booking_date || b.date);
                bookingDate.setHours(0, 0, 0, 0);
                return bookingDate.getTime() === clickedDate.getTime();
              })
              .map(b => ({ ...b, client: c }))
          );

          if (bookingsOnDate.length === 1) {
            onBookingClick(bookingsOnDate[0].client, bookingsOnDate[0]);
          } else if (bookingsOnDate.length > 1) {
            onDateClick(date);
            setTimeout(() => {
              upcomingListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        }}
        today={today}
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