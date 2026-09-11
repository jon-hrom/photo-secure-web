import { useState } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import QuickMeetingDialog from '@/components/calendar/QuickMeetingDialog';
import { useMeetingDates } from '@/hooks/useMeetingDates';

interface BookingWithTime {
  date: Date;
  time?: string;
  fullDateTime: Date;
}

interface InteractiveCalendarProps {
  selectedDate: Date | undefined;
  allBookedDates: Date[];
  allBookingsWithTime?: BookingWithTime[];
  onDateClick: (date: Date | undefined) => void;
  today: Date;
  clients: Client[];
  onBookingClick: (client: Client, booking: any) => void;
}

const InteractiveCalendar = ({
  selectedDate,
  allBookedDates,
  allBookingsWithTime,
  onDateClick,
  today,
  clients,
  onBookingClick,
}: InteractiveCalendarProps) => {
  
  const [meetingDate, setMeetingDate] = useState<Date | null>(null);
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const { hasMeetingOn } = useMeetingDates();

  const handleDateClick = (date: Date | undefined) => {
    // Просто передаём выбранную дату наверх для отображения
    onDateClick(date);

    if (!date) return;

    const clickedDate = new Date(date);
    clickedDate.setHours(0, 0, 0, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (clickedDate < todayStart) return;

    // Дата свободна — открываем форму создания встречи
    if (!hasActiveBookingsOnDate(date) && !hasMeetingOn(date)) {
      setMeetingDate(clickedDate);
      setIsMeetingOpen(true);
    }
  };

  // Функция проверки, есть ли на эту дату активные (не прошедшие) события
  const hasActiveBookingsOnDate = (date: Date): boolean => {
    if (!allBookingsWithTime || allBookingsWithTime.length === 0) {
      return allBookedDates.some(bookedDate => {
        const d1 = new Date(date);
        const d2 = new Date(bookedDate);
        return d1.getDate() === d2.getDate() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getFullYear() === d2.getFullYear();
      });
    }

    const now = new Date();
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return allBookingsWithTime.some(booking => {
      const bookingDate = new Date(booking.date);
      bookingDate.setHours(0, 0, 0, 0);
      
      const isSameDate = checkDate.getTime() === bookingDate.getTime();
      const isNotPassed = booking.fullDateTime >= now;
      
      return isSameDate && isNotPassed;
    });
  };

  return (
    <Card className="overflow-hidden border border-purple-200/50 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
      <div className="bg-gradient-to-r from-purple-100 via-pink-50 to-rose-100 p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 sm:gap-3 text-purple-700">
          <div className="p-1.5 sm:p-2 bg-purple-200/40 backdrop-blur-sm rounded-lg flex-shrink-0">
            <Icon name="Calendar" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-xl font-bold">Календарь съёмок</div>
            <div className="text-purple-600/70 text-xs sm:text-sm font-normal">Выберите дату для просмотра съёмок</div>
          </div>
        </CardTitle>
      </div>
      <CardContent className="p-4 sm:p-6">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-4 shadow-inner">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateClick}
            modifiers={{
              booked: (date) => hasActiveBookingsOnDate(date),
              meeting: (date) => hasMeetingOn(date) && !hasActiveBookingsOnDate(date),
            }}
            modifiersStyles={{
              booked: {
                background: 'linear-gradient(135deg, rgb(134 239 172) 0%, rgb(74 222 128) 100%)',
                color: 'rgb(22 101 52)',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(74, 222, 128, 0.4)',
                transform: 'scale(1.05)',
                transition: 'all 0.3s ease',
              },
              meeting: {
                background: 'linear-gradient(135deg, rgb(147 197 253) 0%, rgb(96 165 250) 100%)',
                color: 'rgb(30 64 175)',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(96, 165, 250, 0.4)',
                transform: 'scale(1.05)',
                transition: 'all 0.3s ease',
              },
            }}
            className="rounded-xl border-0 w-full text-sm sm:text-base [&_.rdp-button]:text-xs [&_.rdp-button]:sm:text-sm [&_.rdp-button]:h-8 [&_.rdp-button]:w-8 [&_.rdp-button]:sm:h-10 [&_.rdp-button]:sm:w-10"
          />
        </div>
        
        <div className="mt-4 sm:mt-5 space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-green-300 to-emerald-400 shadow-md flex-shrink-0"></div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-medium">Даты со съёмками</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-blue-300 to-blue-400 shadow-md flex-shrink-0"></div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-medium">Даты со встречами</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-400 shadow-md flex-shrink-0"></div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-medium">Дата сегодня</p>
          </div>
          <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg sm:rounded-xl">
            <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300 font-medium text-center">
              👆 Нажмите на дату — на свободной откроется форма встречи
            </p>
          </div>
        </div>
      </CardContent>

      <QuickMeetingDialog
        open={isMeetingOpen}
        onOpenChange={setIsMeetingOpen}
        date={meetingDate}
        clients={clients}
      />
    </Card>
  );
};

export default InteractiveCalendar;