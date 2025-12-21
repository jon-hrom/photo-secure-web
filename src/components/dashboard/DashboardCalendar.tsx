import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import Icon from '@/components/ui/icon';
import { Client, Booking, Project } from '@/components/clients/ClientsTypes';

interface DashboardCalendarProps {
  clients: Client[];
  onBookingClick?: (client: Client, booking: Booking) => void;
  onProjectClick?: (client: Client, project: Project) => void;
}

const DashboardCalendar = ({ clients, onBookingClick, onProjectClick }: DashboardCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Все забронированные даты (бронирования)
  const bookedDates = clients.flatMap(c => 
    (c.bookings || []).filter(b => {
      const bookingDate = new Date(b.booking_date || b.date);
      bookingDate.setHours(0, 0, 0, 0);
      return bookingDate >= today;
    }).map(b => {
      const date = new Date(b.booking_date || b.date);
      date.setHours(0, 0, 0, 0);
      return date;
    })
  );

  // Даты съёмок из проектов
  const projectDates = clients.flatMap(c => 
    (c.projects || []).filter(p => {
      if (!p.startDate) return false;
      const projectDate = new Date(p.startDate);
      projectDate.setHours(0, 0, 0, 0);
      return projectDate >= today;
    }).map(p => {
      const date = new Date(p.startDate);
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

    // Находим все проекты на эту дату
    const projectsOnDate = clients.flatMap(c => 
      (c.projects || [])
        .filter(p => {
          if (!p.startDate) return false;
          const projectDate = new Date(p.startDate);
          projectDate.setHours(0, 0, 0, 0);
          return projectDate.getTime() === clickedDate.getTime();
        })
        .map(p => ({ client: c, project: p }))
    );

    // Если одно бронирование - открываем его
    if (bookingsOnDate.length === 1 && projectsOnDate.length === 0 && onBookingClick) {
      onBookingClick(bookingsOnDate[0].client, bookingsOnDate[0].booking);
    } 
    // Если один проект - открываем его
    else if (projectsOnDate.length === 1 && bookingsOnDate.length === 0 && onProjectClick) {
      onProjectClick(projectsOnDate[0].client, projectsOnDate[0].project);
    } 
    // Если несколько - показываем выбор
    else if (bookingsOnDate.length > 0 || projectsOnDate.length > 0) {
      setSelectedDate(date);
    }
  };

  return (
    <div className="space-y-4">
      {/* Компактный календарь */}
      <Card className="border-purple-200/50">
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Calendar" size={16} className="text-purple-600 sm:w-[18px] sm:h-[18px]" />
              <h3 className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-900">Календарь съёмок</h3>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-gray-600">
              👆 Нажмите на дату
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl sm:rounded-2xl p-2 sm:p-4 shadow-inner">
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
                project: (date) => {
                  const checkDate = new Date(date);
                  checkDate.setHours(0, 0, 0, 0);
                  
                  if (checkDate < today) {
                    return false;
                  }
                  
                  return projectDates.some(projectDate => {
                    const d1 = new Date(date);
                    const d2 = new Date(projectDate);
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
                project: {
                  background: 'linear-gradient(135deg, rgb(134 239 172) 0%, rgb(187 247 208) 100%)',
                  color: 'rgb(22 101 52)',
                  fontWeight: 'bold',
                  boxShadow: '0 8px 15px -3px rgba(134, 239, 172, 0.3)',
                  transform: 'scale(1.05)',
                  transition: 'all 0.3s ease',
                },
              }}
              className="rounded-xl border-0 w-full text-sm sm:text-base [&_.rdp-button]:text-xs [&_.rdp-button]:sm:text-sm [&_.rdp-button]:h-8 [&_.rdp-button]:w-8 [&_.rdp-button]:sm:h-10 [&_.rdp-button]:sm:w-10"
            />
          </div>
          
          <div className="mt-3 sm:mt-5 space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-green-300 to-green-200 shadow-md flex-shrink-0"></div>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-900 font-medium">Даты со съёмками</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-400 shadow-md flex-shrink-0"></div>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-900 font-medium">Дата сегодня</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardCalendar;