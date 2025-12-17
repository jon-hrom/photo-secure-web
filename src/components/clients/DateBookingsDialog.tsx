import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Client, Booking } from '@/components/clients/ClientsTypes';

interface BookingWithClient extends Booking {
  client: Client;
}

interface DateBookingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  bookings: BookingWithClient[];
  onBookingClick: (booking: BookingWithClient) => void;
}

const DateBookingsDialog = ({
  open,
  onOpenChange,
  selectedDate,
  bookings,
  onBookingClick,
}: DateBookingsDialogProps) => {
  if (!selectedDate) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      weekday: 'long'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] bg-gradient-to-br from-purple-50/90 via-pink-50/80 to-rose-50/90 backdrop-blur-sm border-2 border-purple-200/50 shadow-2xl flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-purple-200/30 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-200 to-pink-200 rounded-xl shadow-md">
              <Icon name="Calendar" size={24} className="text-purple-700" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Бронирования на дату
              </DialogTitle>
              <p className="text-sm text-purple-600/70 mt-1 font-medium capitalize">
                {formatDate(selectedDate)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
          {bookings.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="CalendarX" size={64} className="mx-auto mb-4 text-purple-300" />
              <p className="text-lg text-purple-600/70 font-medium">
                На эту дату нет бронирований
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking, index) => (
                <div
                  key={booking.id}
                  onClick={() => onBookingClick(booking)}
                  className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-white to-purple-50/40 hover:from-white hover:to-purple-100/50 border-2 border-purple-200/40 hover:border-purple-300 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-200/0 via-purple-200/20 to-pink-200/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-3 bg-gradient-to-br from-purple-200 to-pink-200 rounded-xl shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                          <Icon name="User" size={20} className="text-purple-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-bold text-gray-900 truncate">
                            {booking.client.name}
                          </p>
                          {booking.client.phone && (
                            <p className="text-sm text-gray-600 mt-1">{booking.client.phone}</p>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className="bg-purple-100 text-purple-700 border-purple-200 px-3 py-1 flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                      >
                        <Icon name="Clock" size={14} className="mr-1" />
                        {booking.booking_time || booking.time}
                      </Badge>
                    </div>

                    {booking.title && (
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-green-100/50 to-emerald-100/50">
                        <div className="p-2 bg-green-200/50 rounded-lg flex-shrink-0">
                          <Icon name="Camera" size={16} className="text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-green-600/70 font-medium mb-1">Тип съёмки</p>
                          <p className="font-semibold text-gray-900">{booking.title}</p>
                        </div>
                      </div>
                    )}

                    {booking.description && (
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-100/50 to-orange-100/50">
                        <div className="p-2 bg-amber-200/50 rounded-lg flex-shrink-0">
                          <Icon name="FileText" size={16} className="text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-amber-600/70 font-medium mb-1">Описание</p>
                          <p className="text-sm text-gray-700 line-clamp-2">{booking.description}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-200/30">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookingClick(booking);
                        }}
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-100/50 group-hover:scale-105 transition-transform"
                      >
                        <Icon name="Eye" size={16} className="mr-2" />
                        Подробнее
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-purple-200/30 bg-white/50 backdrop-blur-sm flex-shrink-0">
          <Button 
            onClick={() => onOpenChange(false)} 
            variant="outline"
            className="w-full border-purple-200 hover:bg-purple-50 hover:border-purple-300"
          >
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DateBookingsDialog;
