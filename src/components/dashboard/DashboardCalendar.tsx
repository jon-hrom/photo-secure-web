import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import Icon from '@/components/ui/icon';
import { Client, Booking } from '@/components/clients/ClientsTypes';

interface DashboardCalendarProps {
  clients: Client[];
  onBookingClick?: (client: Client, booking: Booking) => void;
}

const DashboardCalendar = ({ clients, onBookingClick }: DashboardCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Все забронированные даты
  const bookedDates = clients.flatMap(c => 
    (c.bookings || []).filter(b => {
      const bookingDate = new Date(b.booking_date || b.date);
      bookingDate.setHours(0, 0, 0, 0);
      return bookingDate >= today; // Только будущие бронирования
    }).map(b => {
      const date = new Date(b.booking_date || b.date);
      date.setHours(0, 0, 0, 0);
      return date;
    })
  );

  const handleDateClick = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(date);
      return;
    }

    const clickedDate = new Date(date);
    clickedDate.setHours(0, 0, 0, 0);
    
    // Находим все бронирования на эту дату
    const bookingsOnDate = clients.flatMap(c => 
      (c.bookings || [])
        .filter(b => {
          const bookingDate = new Date(b.booking_date || b.date);
          bookingDate.setHours(0, 0, 0, 0);
          return bookingDate.getTime() === clickedDate.getTime();
        })
        .map(b => ({ client: c, booking: b }))
    );

    // Если одно бронирование - сразу открываем диалог
    if (bookingsOnDate.length === 1 && onBookingClick) {
      onBookingClick(bookingsOnDate[0].client, bookingsOnDate[0].booking);
    } else if (bookingsOnDate.length > 0) {
      setSelectedDate(date);
    }
  };

  return (
    <div className="space-y-4">
      {/* Компактный календарь */}
      <Card className="border-purple-200/50">
        <CardContent className="p-4">
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Calendar" size={18} className="text-purple-600" />
              <h3 className="font-semibold text-sm">Календарь бронирований</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              👆 Нажмите на дату для просмотра бронирований
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 shadow-inner">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateClick}
              modifiers={{
                booked: (date) => {
                  const checkDate = new Date(date);
                  checkDate.setHours(0, 0, 0, 0);
                  
                  if (checkDate < today) {
                    return false;
                  }
                  
                  return bookedDates.some(bookedDate => {
                    const d1 = new Date(date);
                    const d2 = new Date(bookedDate);
                    return d1.getDate() === d2.getDate() &&
                           d1.getMonth() === d2.getMonth() &&
                           d1.getFullYear() === d2.getFullYear();
                  });
                },
              }}
              modifiersStyles={{
                booked: {
                  background: 'linear-gradient(135deg, rgb(216 180 254) 0%, rgb(251 207 232) 100%)',
                  color: 'rgb(107 33 168)',
                  fontWeight: 'bold',
                  boxShadow: '0 8px 15px -3px rgba(216, 180, 254, 0.3)',
                  transform: 'scale(1.05)',
                  transition: 'all 0.3s ease',
                },
              }}
              className="rounded-xl border-0 w-full"
            />
          </div>
          
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 shadow-md flex-shrink-0"></div>
              <p className="text-sm text-gray-700 font-medium">Даты с бронированиями</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-400 shadow-md flex-shrink-0"></div>
              <p className="text-sm text-gray-700 font-medium">Дата сегодня</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardCalendar;