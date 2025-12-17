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
      <DialogContent className="max-w-md bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm border-2 border-purple-200/50 shadow-2xl" aria-describedby="booking-details-description">
        <DialogHeader className="border-b border-purple-200/30 pb-4">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Детали бронирования
          </DialogTitle>
        </DialogHeader>
        <div id="booking-details-description" className="sr-only">
          Просмотр информации о бронировании клиента
        </div>
        <div className="space-y-6 pt-6">
          <div className="space-y-4">
            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-100/50 to-pink-100/50 hover:from-purple-100 hover:to-pink-100 transition-all duration-300 shadow-sm hover:shadow-md">
              <div className="p-3 bg-gradient-to-br from-purple-200 to-pink-200 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Icon name="User" size={20} className="text-purple-700" />
              </div>
              <div>
                <p className="text-xs text-purple-600/70 font-medium mb-1">Клиент</p>
                <p className="font-bold text-lg text-gray-900">{client.name}</p>
              </div>
            </div>

            {booking.title && (
              <div className="group p-4 rounded-2xl bg-gradient-to-br from-green-100/50 to-emerald-100/50 hover:from-green-100 hover:to-emerald-100 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-200/50 rounded-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    <Icon name="Camera" size={18} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-green-600/70 font-medium mb-1">Что за съёмка</p>
                    <p className="font-bold text-base text-gray-900">{booking.title}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="group p-4 rounded-2xl bg-gradient-to-br from-blue-100/50 to-cyan-100/50 hover:from-blue-100 hover:to-cyan-100 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-200/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Icon name="Calendar" size={16} className="text-blue-600" />
                  </div>
                  <p className="text-xs text-blue-600/70 font-medium">Дата</p>
                </div>
                <p className="font-bold text-gray-900">
                  {booking.booking_date 
                    ? new Date(booking.booking_date).toLocaleDateString('ru-RU')
                    : booking.date instanceof Date 
                      ? booking.date.toLocaleDateString('ru-RU') 
                      : booking.date
                  }
                </p>
              </div>

              <div className="group p-4 rounded-2xl bg-gradient-to-br from-indigo-100/50 to-purple-100/50 hover:from-indigo-100 hover:to-purple-100 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-indigo-200/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Icon name="Clock" size={16} className="text-indigo-600" />
                  </div>
                  <p className="text-xs text-indigo-600/70 font-medium">Время</p>
                </div>
                <p className="font-bold text-gray-900">{booking.booking_time || booking.time}</p>
              </div>
            </div>

            {booking.description && (
              <div className="group p-4 rounded-2xl bg-gradient-to-br from-amber-100/50 to-orange-100/50 hover:from-amber-100 hover:to-orange-100 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-200/50 rounded-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    <Icon name="FileText" size={18} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-amber-600/70 font-medium mb-2">Примечание</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{booking.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-purple-200/30">
            {client.phone && (
              <Button 
                variant="outline" 
                className="flex-1 border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-all duration-300"
                onClick={() => window.open(`tel:${client.phone}`, '_self')}
              >
                <Icon name="Phone" size={18} className="mr-2 text-purple-600" />
                Позвонить
              </Button>
            )}
            {client.email && (
              <Button 
                variant="outline" 
                className="flex-1 border-pink-200 hover:bg-pink-50 hover:border-pink-300 transition-all duration-300"
                onClick={() => window.open(`mailto:${client.email}`, '_blank')}
              >
                <Icon name="Mail" size={18} className="mr-2 text-pink-600" />
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
