import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
}

interface Booking {
  id: number;
  date?: Date;
  booking_date?: Date | string;
  time?: string;
  booking_time?: string;
  title?: string;
  description?: string;
}

interface DashboardBookingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  booking: Booking | null;
}

const DashboardBookingDetailsDialog = ({ 
  open, 
  onOpenChange, 
  client, 
  booking 
}: DashboardBookingDetailsDialogProps) => {
  if (!client || !booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 dark:from-purple-950/80 dark:via-pink-950/60 dark:to-rose-950/80 backdrop-blur-sm border-2 border-purple-200/50 dark:border-purple-800/50 shadow-2xl" aria-describedby="booking-details-description">
        <DialogHeader className="border-b border-purple-200/30 dark:border-purple-800/30 pb-3 sm:pb-4">
          <DialogTitle className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Детали бронирования
          </DialogTitle>
        </DialogHeader>
        <div id="booking-details-description" className="sr-only">
          Просмотр информации о бронировании клиента
        </div>
        <div className="space-y-4 sm:space-y-6 pt-4 sm:pt-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="group flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-100/50 to-pink-100/50 dark:from-purple-900/50 dark:to-pink-900/50 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900 dark:hover:to-pink-900 transition-all duration-300 shadow-sm hover:shadow-md">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-200 to-pink-200 dark:from-purple-800 dark:to-pink-800 rounded-lg sm:rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Icon name="User" size={18} className="text-purple-700 dark:text-purple-300 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-purple-600/70 dark:text-purple-400/70 font-medium mb-0.5 sm:mb-1">Клиент</p>
                <p className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">{client.name}</p>
              </div>
            </div>

            {booking.title && (
              <div className="group p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-100/50 to-emerald-100/50 dark:from-green-900/50 dark:to-emerald-900/50 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900 dark:hover:to-emerald-900 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-green-200/50 dark:bg-green-800/50 rounded-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    <Icon name="Camera" size={16} className="text-green-600 dark:text-green-400 sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs text-green-600/70 dark:text-green-400/70 font-medium mb-0.5 sm:mb-1">Что за съёмка</p>
                    <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words">{booking.title}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="group p-4 rounded-2xl bg-gradient-to-br from-blue-100/50 to-cyan-100/50 dark:from-blue-900/50 dark:to-cyan-900/50 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900 dark:hover:to-cyan-900 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-200/50 dark:bg-blue-800/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Icon name="Calendar" size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">Дата</p>
                </div>
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {booking.booking_date 
                    ? new Date(booking.booking_date).toLocaleDateString('ru-RU')
                    : booking.date instanceof Date 
                      ? booking.date.toLocaleDateString('ru-RU') 
                      : booking.date
                  }
                </p>
              </div>

              <div className="group p-4 rounded-2xl bg-gradient-to-br from-indigo-100/50 to-purple-100/50 dark:from-indigo-900/50 dark:to-purple-900/50 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900 dark:hover:to-purple-900 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-indigo-200/50 dark:bg-indigo-800/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Icon name="Clock" size={16} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 font-medium">Время</p>
                </div>
                <p className="font-bold text-gray-900 dark:text-gray-100">{booking.booking_time || booking.time}</p>
              </div>
            </div>

            {booking.description && (
              <div className="group p-4 rounded-2xl bg-gradient-to-br from-amber-100/50 to-orange-100/50 dark:from-amber-900/50 dark:to-orange-900/50 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900 dark:hover:to-orange-900 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-200/50 dark:bg-amber-800/50 rounded-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    <Icon name="FileText" size={18} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/70 font-medium mb-2">Примечание</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{booking.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-purple-200/30 dark:border-purple-800/30">
            {client.phone && (
              <Button 
                variant="outline" 
                className="flex-1 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-300"
                onClick={() => window.open(`tel:${client.phone}`, '_self')}
              >
                <Icon name="Phone" size={18} className="mr-2 text-purple-600 dark:text-purple-400" />
                Позвонить
              </Button>
            )}
            {client.email && (
              <Button 
                variant="outline" 
                className="flex-1 border-pink-200 dark:border-pink-700 hover:bg-pink-50 dark:hover:bg-pink-900/30 hover:border-pink-300 dark:hover:border-pink-600 transition-all duration-300"
                onClick={() => window.open(`mailto:${client.email}`, '_blank')}
              >
                <Icon name="Mail" size={18} className="mr-2 text-pink-600 dark:text-pink-400" />
                Написать
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DashboardBookingDetailsDialog;