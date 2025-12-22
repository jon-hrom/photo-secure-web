import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface BookingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: number;
  userId: string | null;
}

interface BookingDetails {
  id: number;
  clientName: string;
  date: string;
  time: string;
  title?: string;
  description?: string;
  location?: string;
  notificationEnabled?: boolean;
}

const BookingDetailsDialog = ({ open, onOpenChange, bookingId, userId }: BookingDetailsDialogProps) => {
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && bookingId && userId) {
      fetchBookingDetails();
    }
  }, [open, bookingId, userId]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://functions.poehali.dev/c9c95946-cd1a-45f3-ad47-9390b5e1b47b?userId=${userId}`);
      const appointments = await res.json();
      
      const found = appointments.find((apt: any) => apt.id === bookingId);
      if (found) {
        const meetingDate = new Date(found.date);
        setBooking({
          id: found.id,
          clientName: found.clientName || 'Без имени',
          date: meetingDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
          time: meetingDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          title: found.title,
          description: found.description,
          location: found.location,
          notificationEnabled: found.notificationEnabled,
        });
      } else {
        toast.error('Бронирование не найдено');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to load booking details:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBooking = async () => {
    if (!booking || !userId) return;

    const confirmed = window.confirm('Вы уверены, что хотите удалить это бронирование?');
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`https://functions.poehali.dev/c9c95946-cd1a-45f3-ad47-9390b5e1b47b`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          bookingId: booking.id,
        }),
      });

      if (response.ok) {
        toast.success('Бронирование удалено');
        onOpenChange(false);
        window.location.reload();
      } else {
        toast.error('Ошибка при удалении');
      }
    } catch (error) {
      console.error('Failed to delete booking:', error);
      toast.error('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  if (!booking && !loading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 dark:from-purple-950/80 dark:via-pink-950/60 dark:to-rose-950/80 backdrop-blur-sm border-2 border-purple-200/50 dark:border-purple-800/50 shadow-2xl">
        <DialogHeader className="border-b border-purple-200/30 dark:border-purple-800/30 pb-4">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Детали бронирования
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : booking ? (
          <div className="space-y-6 pt-6">
            <div className="space-y-4">
              <div className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-100/50 to-pink-100/50 dark:from-purple-900/50 dark:to-pink-900/50 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900 dark:hover:to-pink-900 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="p-3 bg-gradient-to-br from-purple-200 to-pink-200 dark:from-purple-800 dark:to-pink-800 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                  <Icon name="User" size={20} className="text-purple-700 dark:text-purple-300" />
                </div>
                <div>
                  <p className="text-xs text-purple-600/70 dark:text-purple-400/70 font-medium mb-1">Клиент</p>
                  <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{booking.clientName}</p>
                </div>
              </div>

              {booking.title && (
                <div className="group p-4 rounded-2xl bg-gradient-to-br from-green-100/50 to-emerald-100/50 dark:from-green-900/50 dark:to-emerald-900/50 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900 dark:hover:to-emerald-900 transition-all duration-300 shadow-sm hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-200/50 dark:bg-green-800/50 rounded-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                      <Icon name="Camera" size={18} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-green-600/70 dark:text-green-400/70 font-medium mb-1">Что за съёмка</p>
                      <p className="font-bold text-base text-gray-900 dark:text-gray-100">{booking.title}</p>
                      {booking.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">{booking.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="group p-4 rounded-2xl bg-gradient-to-br from-blue-100/50 to-cyan-100/50 dark:from-blue-900/50 dark:to-cyan-900/50 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900 dark:hover:to-cyan-900 transition-all duration-300 shadow-sm hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-200/50 dark:bg-blue-800/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                      <Icon name="Calendar" size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">Дата</p>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{booking.date}</p>
                </div>

                <div className="group p-4 rounded-2xl bg-gradient-to-br from-orange-100/50 to-amber-100/50 dark:from-orange-900/50 dark:to-amber-900/50 hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900 dark:hover:to-amber-900 transition-all duration-300 shadow-sm hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-orange-200/50 dark:bg-orange-800/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                      <Icon name="Clock" size={16} className="text-orange-600 dark:text-orange-400" />
                    </div>
                    <p className="text-xs text-orange-600/70 dark:text-orange-400/70 font-medium">Время</p>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{booking.time}</p>
                </div>
              </div>

              {booking.notificationEnabled && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-teal-100/50 to-cyan-100/50 dark:from-teal-900/50 dark:to-cyan-900/50 shadow-sm">
                  <div className="p-2 bg-teal-200/50 dark:bg-teal-800/50 rounded-lg">
                    <Icon name="Bell" size={18} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Уведомление за 1 день</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-purple-200/30 dark:border-purple-800/30">
              <Button
                variant="destructive"
                onClick={handleDeleteBooking}
                disabled={loading}
                className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Icon name="Trash2" size={18} className="mr-2" />
                Удалить бронирование
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailsDialog;