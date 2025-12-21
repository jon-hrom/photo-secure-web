import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';

interface BookingWithClient {
  id: number;
  date: Date;
  time: string;
  description?: string;
  client: Client;
  normalizedDate?: Date;
}

interface UpcomingBookingsListProps {
  upcomingBookings: BookingWithClient[];
  selectedClient: Client | null;
  onMessageClient: (client: Client) => void;
  selectedDate?: Date;
  onClearFilter: () => void;
  onBookingClick?: (booking: BookingWithClient) => void;
}

const UpcomingBookingsList = ({ 
  upcomingBookings, 
  selectedClient, 
  onMessageClient,
  selectedDate,
  onClearFilter,
  onBookingClick
}: UpcomingBookingsListProps) => {
  const formatDate = (booking: BookingWithClient) => {
    const date = booking.normalizedDate || new Date(booking.date);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getDaysUntil = (booking: BookingWithClient) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = booking.normalizedDate || new Date(booking.date);
    bookingDate.setHours(0, 0, 0, 0);
    const diffTime = bookingDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card className="overflow-hidden border border-blue-200/50 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500">
      <div className="bg-gradient-to-r from-blue-100 via-cyan-50 to-teal-100 p-3 sm:p-5">
        <CardTitle className="flex items-center justify-between text-blue-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-200/40 backdrop-blur-sm rounded-lg flex-shrink-0">
              <Icon name="CalendarDays" size={18} className="text-blue-600 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold">Предстоящие встречи</div>
              {selectedDate && (
                <div className="text-[10px] sm:text-xs text-blue-600/70 font-normal mt-0.5">
                  {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
          {selectedDate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearFilter}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-100/50"
            >
              <Icon name="X" size={16} className="mr-1" />
              Сбросить
            </Button>
          )}
        </CardTitle>
      </div>
      <CardContent className="p-3 sm:p-5 space-y-2 sm:space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
        {upcomingBookings.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-600">
            <Icon name="CalendarX" size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Нет предстоящих встреч</p>
          </div>
        ) : (
          upcomingBookings.map((booking, index) => {
            const daysUntil = getDaysUntil(booking);
            const isUrgent = daysUntil <= 3;
            
            return (
              <div 
                key={booking.id}
                onClick={() => onBookingClick?.(booking)}
                className={`group relative overflow-hidden rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-lg transition-all duration-300 border cursor-pointer animate-in fade-in slide-in-from-left-6 duration-500 ${
                  isUrgent 
                    ? 'bg-gradient-to-br from-white to-orange-50/30 border-orange-200/40 hover:border-orange-300' 
                    : 'bg-gradient-to-br from-white to-blue-50/30 border-blue-200/40 hover:border-blue-300'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                  isUrgent 
                    ? 'from-orange-200/0 via-orange-200/10 to-orange-200/0' 
                    : 'from-blue-200/0 via-blue-200/10 to-blue-200/0'
                }`} />
                <div className="relative z-10 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 ${
                        isUrgent ? 'bg-orange-100' : 'bg-blue-100'
                      }`}>
                        <Icon name="User" size={16} className={isUrgent ? 'text-orange-600' : 'text-blue-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-900 truncate">{booking.client.name}</p>
                        {booking.client.phone && (
                          <p className="text-xs text-gray-500 dark:text-gray-600">{booking.client.phone}</p>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs px-2 py-1 flex-shrink-0 group-hover:scale-110 transition-transform duration-300 ${
                        isUrgent 
                          ? 'bg-orange-100 text-orange-700 border-orange-200' 
                          : 'bg-blue-100 text-blue-700 border-blue-200'
                      }`}
                    >
                      {daysUntil === 0 ? 'Сегодня' : daysUntil === 1 ? 'Завтра' : `${daysUntil} дн.`}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-700">
                    <Icon name="Calendar" size={12} className={`flex-shrink-0 ${isUrgent ? 'text-orange-500' : 'text-blue-500'}`} />
                    <span className="font-medium">{formatDate(booking)}</span>
                    <span className="text-gray-400">•</span>
                    <Icon name="Clock" size={12} className={`flex-shrink-0 ${isUrgent ? 'text-orange-500' : 'text-blue-500'}`} />
                    <span className="font-medium">{booking.time}</span>
                    {booking.description && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="truncate">{booking.description}</span>
                      </>
                    )}
                  </div>

                  {booking.client.vkProfile && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMessageClient(booking.client);
                      }}
                      className={`w-full text-xs group-hover:scale-105 transition-all duration-300 ${
                        isUrgent 
                          ? 'border-orange-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700' 
                          : 'border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                      }`}
                    >
                      <Icon name="MessageCircle" size={14} className="mr-2" />
                      Написать
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingBookingsList;