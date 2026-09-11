import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import Icon from '@/components/ui/icon';
import { Client, Booking, Project } from '@/components/clients/ClientsTypes';
import QuickMeetingDialog from '@/components/calendar/QuickMeetingDialog';
import MeetingDetailsDialog from '@/components/calendar/MeetingDetailsDialog';
import { useMeetingDates } from '@/hooks/useMeetingDates';
import { Meeting } from '@/components/clients/dialog/MeetingService';

interface DashboardCalendarProps {
  clients: Client[];
  onBookingClick?: (client: Client, booking: Booking) => void;
  onProjectClick?: (client: Client, project: Project) => void;
}

const DashboardCalendar = ({ clients, onBookingClick, onProjectClick }: DashboardCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [meetingDate, setMeetingDate] = useState<Date | null>(null);
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [viewMeetings, setViewMeetings] = useState<Meeting[]>([]);
  const [viewMeetingDate, setViewMeetingDate] = useState<Date | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const { hasMeetingOn, getMeetingsOn } = useMeetingDates();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  // Все забронированные даты с учётом времени (бронирования)
  const bookedDatesWithTime = clients.flatMap(c => 
    (c.bookings || []).map(b => {
      const date = new Date(b.booking_date || b.date);
      date.setHours(0, 0, 0, 0);
      
      const fullDateTime = new Date(b.booking_date || b.date);
      if (b.time) {
        const [hours, minutes] = b.time.split(':').map(Number);
        fullDateTime.setHours(hours, minutes, 0, 0);
      } else {
        fullDateTime.setHours(23, 59, 59, 999);
      }
      
      return { date, fullDateTime, isActive: fullDateTime >= now };
    })
  );

  // Даты съёмок из проектов с учётом времени
  const projectDatesWithTime = clients.flatMap(c => 
    (c.projects || [])
      .filter(p => p.startDate && p.status !== 'cancelled')
      .map(p => {
        const date = new Date(p.startDate);
        date.setHours(0, 0, 0, 0);
        
        const fullDateTime = new Date(p.startDate);
        if (p.shooting_time) {
          const [hours, minutes] = p.shooting_time.split(':').map(Number);
          fullDateTime.setHours(hours, minutes, 0, 0);
        } else {
          fullDateTime.setHours(23, 59, 59, 999);
        }
        
        return { date, fullDateTime, isActive: fullDateTime >= now };
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

    const meetingsOnDate = getMeetingsOn(clickedDate);

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
    // На дату назначена встреча — показываем её карточку
    else if (meetingsOnDate.length > 0) {
      setSelectedDate(date);
      setViewMeetings(meetingsOnDate);
      setViewMeetingDate(clickedDate);
      setIsViewOpen(true);
    }
    // Дата свободна — открываем форму создания встречи
    else {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (clickedDate < todayStart) {
        setSelectedDate(date);
        return;
      }
      setSelectedDate(date);
      setMeetingDate(clickedDate);
      setIsMeetingOpen(true);
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
              <h3 className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white">Календарь съёмок</h3>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-gray-300">
              👆 Нажмите на дату — на свободной откроется форма встречи
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl sm:rounded-2xl p-2 sm:p-4 shadow-inner">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateClick}
              modifiers={{
                booked: (date) => {
                  const checkDate = new Date(date);
                  checkDate.setHours(0, 0, 0, 0);
                  
                  return bookedDatesWithTime.some(b => {
                    return b.isActive && b.date.getTime() === checkDate.getTime();
                  });
                },
                project: (date) => {
                  const checkDate = new Date(date);
                  checkDate.setHours(0, 0, 0, 0);
                  const hasShooting = projectDatesWithTime.some(
                    p => p.isActive && p.date.getTime() === checkDate.getTime()
                  );
                  // В совмещённый день красим половинками, обычный зелёный не нужен
                  return hasShooting && !hasMeetingOn(date);
                },
                meeting: (date) => {
                  const checkDate = new Date(date);
                  checkDate.setHours(0, 0, 0, 0);
                  const hasShooting = projectDatesWithTime.some(
                    p => p.isActive && p.date.getTime() === checkDate.getTime()
                  );
                  return !hasShooting && hasMeetingOn(date);
                },
                bothEvents: (date) => {
                  const checkDate = new Date(date);
                  checkDate.setHours(0, 0, 0, 0);
                  const hasShooting = projectDatesWithTime.some(
                    p => p.isActive && p.date.getTime() === checkDate.getTime()
                  );
                  return hasShooting && hasMeetingOn(date);
                },
              }}
              modifiersClassNames={{
                bothEvents: 'day-shooting-and-meeting',
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
                meeting: {
                  background: 'linear-gradient(135deg, rgb(147 197 253) 0%, rgb(191 219 254) 100%)',
                  color: 'rgb(30 64 175)',
                  fontWeight: 'bold',
                  boxShadow: '0 8px 15px -3px rgba(147, 197, 253, 0.4)',
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
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-medium">Даты со съёмками</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-blue-300 to-blue-200 shadow-md flex-shrink-0"></div>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-medium">Даты со встречами</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full shadow-md flex-shrink-0"
                style={{
                  background:
                    'linear-gradient(to right, rgb(134 239 172) 0%, rgb(134 239 172) 50%, rgb(147 197 253) 50%, rgb(147 197 253) 100%)',
                }}
              />
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-medium">Съёмка и встреча</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-400 shadow-md flex-shrink-0"></div>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-medium">Дата сегодня</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <QuickMeetingDialog
        open={isMeetingOpen}
        onOpenChange={setIsMeetingOpen}
        date={meetingDate}
        clients={clients}
      />

      <MeetingDetailsDialog
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        meetings={viewMeetings}
        clients={clients}
        date={viewMeetingDate}
      />
    </div>
  );
};

export default DashboardCalendar;