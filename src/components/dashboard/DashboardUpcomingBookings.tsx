import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Client, Booking } from '@/components/clients/ClientsTypes';
import { formatLocalDate } from '@/utils/dateFormat';

interface BookingWithClient extends Booking {
  client: Client;
}

interface DashboardUpcomingBookingsProps {
  bookings: BookingWithClient[];
  onBookingClick?: (client: Client, booking: Booking) => void;
}

const DashboardUpcomingBookings = ({ 
  bookings, 
  onBookingClick 
}: DashboardUpcomingBookingsProps) => {
  const formatDate = (date: Date) => {
    return formatLocalDate(date.toISOString(), 'date');
  };

  const getDaysUntil = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);
    const diffTime = bookingDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card className="overflow-hidden border border-blue-200/50 dark:border-blue-800/50 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div className="bg-gradient-to-r from-blue-100 via-cyan-50 to-teal-100 dark:from-blue-950 dark:via-cyan-950 dark:to-teal-950 p-3 sm:p-5">
        <CardTitle className="flex items-center justify-between text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-200/40 dark:bg-blue-800/40 backdrop-blur-sm rounded-lg flex-shrink-0">
              <Icon name="CalendarDays" size={18} className="text-blue-600 dark:text-blue-400 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-lg font-bold">Ближайшие встречи</div>
              <div className="text-[10px] sm:text-xs text-blue-600/70 dark:text-blue-400/70 font-normal mt-0.5">
                Следующие {bookings.length} бронирований
              </div>
            </div>
          </div>
        </CardTitle>
      </div>
      <CardContent className="p-3 sm:p-5 space-y-2 sm:space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
        {bookings.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400">
            <Icon name="CalendarX" size={40} className="mx-auto mb-2 sm:mb-3 text-gray-300 dark:text-gray-400 sm:w-12 sm:h-12" />
            <p className="text-xs sm:text-sm">Нет предстоящих встреч</p>
          </div>
        ) : (
          bookings.map((booking, index) => {
            const daysUntil = getDaysUntil(booking.date);
            const isUrgent = daysUntil <= 3;
            
            return (
              <div 
                key={booking.id}
                onClick={() => onBookingClick?.(booking.client, booking)}
                className={`group relative overflow-hidden rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-lg transition-all duration-300 border cursor-pointer ${
                  isUrgent 
                    ? 'bg-gradient-to-br from-white to-orange-50/30 dark:from-gray-900 dark:to-orange-950/30 border-orange-200/40 dark:border-orange-800/40 hover:border-orange-300 dark:hover:border-orange-700' 
                    : 'bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-950/30 border-blue-200/40 dark:border-blue-800/40 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                  isUrgent 
                    ? 'from-orange-200/0 via-orange-200/10 to-orange-200/0 dark:from-orange-800/0 dark:via-orange-800/10 dark:to-orange-800/0' 
                    : 'from-blue-200/0 via-blue-200/10 to-blue-200/0 dark:from-blue-800/0 dark:via-blue-800/10 dark:to-blue-800/0'
                }`} />
                <div className="relative z-10 space-y-2 sm:space-y-3">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className={`p-1.5 sm:p-2 rounded-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 flex-shrink-0 ${
                        isUrgent ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-blue-100 dark:bg-blue-900/50'
                      }`}>
                        <Icon name="User" size={14} className={`${isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'} sm:w-4 sm:h-4`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">{booking.client.name}</p>
                        {booking.client.phone && (
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{booking.client.phone}</p>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 flex-shrink-0 group-hover:scale-110 transition-transform duration-300 ${
                        isUrgent 
                          ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' 
                          : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {daysUntil === 0 ? 'Сегодня' : daysUntil === 1 ? 'Завтра' : `${daysUntil} дн.`}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Icon name="Calendar" size={10} className={`flex-shrink-0 sm:w-3 sm:h-3 ${isUrgent ? 'text-orange-500 dark:text-orange-400' : 'text-blue-500 dark:text-blue-400'}`} />
                      <span className="font-medium">{formatDate(booking.date)}</span>
                    </div>
                    <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1">
                      <Icon name="Clock" size={10} className={`flex-shrink-0 sm:w-3 sm:h-3 ${isUrgent ? 'text-orange-500 dark:text-orange-400' : 'text-blue-500 dark:text-blue-400'}`} />
                      <span className="font-medium">{booking.time}</span>
                    </div>
                    {booking.description && (
                      <>
                        <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">•</span>
                        <span className="truncate">{booking.description}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardUpcomingBookings;