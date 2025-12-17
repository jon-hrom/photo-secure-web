import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';

interface BookingWithClient {
  id: number;
  date: Date;
  time: string;
  description?: string;
  client: Client;
}

interface TodayBookingsListProps {
  todayBookings: BookingWithClient[];
}

const TodayBookingsList = ({ todayBookings }: TodayBookingsListProps) => {
  if (todayBookings.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden border border-orange-200/50 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-400">
      <div className="bg-gradient-to-r from-orange-100 via-rose-50 to-pink-100 p-5">
        <CardTitle className="flex items-center gap-3 text-orange-700">
          <div className="p-2 bg-orange-200/40 backdrop-blur-sm rounded-lg animate-pulse">
            <Icon name="Clock" size={20} className="text-orange-600" />
          </div>
          <div className="text-lg font-bold">Сегодня • {todayBookings.length} встреч</div>
        </CardTitle>
      </div>
      <CardContent className="p-5 space-y-3">
        {todayBookings.map((booking, index) => (
          <div 
            key={booking.id}
            className="group relative overflow-hidden bg-gradient-to-br from-white to-orange-50/30 rounded-xl p-4 shadow-sm hover:shadow-lg transition-all duration-300 border border-orange-200/40 hover:border-orange-300 animate-in fade-in slide-in-from-left-6 duration-500"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-200/0 via-orange-200/10 to-orange-200/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 bg-orange-100 rounded-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <Icon name="Clock" size={16} className="text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{booking.client.name}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Icon name="Clock" size={12} className="text-orange-500 flex-shrink-0" />
                    <span className="font-medium">{booking.time}</span>
                    {booking.description && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="truncate">{booking.description}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-2 py-1 flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                Сегодня
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TodayBookingsList;