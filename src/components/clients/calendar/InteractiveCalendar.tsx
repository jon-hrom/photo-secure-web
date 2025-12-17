import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import Icon from '@/components/ui/icon';

interface InteractiveCalendarProps {
  selectedDate: Date | undefined;
  allBookedDates: Date[];
  onDateClick: (date: Date | undefined) => void;
  today: Date;
}

const InteractiveCalendar = ({
  selectedDate,
  allBookedDates,
  onDateClick,
  today,
}: InteractiveCalendarProps) => {
  return (
    <Card className="overflow-hidden border border-purple-200/50 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
      <div className="bg-gradient-to-r from-purple-100 via-pink-50 to-rose-100 p-6">
        <CardTitle className="flex items-center gap-3 text-purple-700">
          <div className="p-2 bg-purple-200/40 backdrop-blur-sm rounded-lg">
            <Icon name="Calendar" size={24} className="text-purple-600" />
          </div>
          <div>
            <div className="text-xl font-bold">Календарь бронирований</div>
            <div className="text-purple-600/70 text-sm font-normal">Выберите дату для просмотра записей</div>
          </div>
        </CardTitle>
      </div>
      <CardContent className="p-6">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 shadow-inner">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onDateClick}
            modifiers={{
              booked: (date) => {
                const checkDate = new Date(date);
                checkDate.setHours(0, 0, 0, 0);
                
                if (checkDate < today) {
                  return false;
                }
                
                return allBookedDates.some(bookedDate => {
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
          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
            <p className="text-xs text-purple-700 font-medium text-center">
              👆 Нажмите на дату для просмотра бронирований
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InteractiveCalendar;
