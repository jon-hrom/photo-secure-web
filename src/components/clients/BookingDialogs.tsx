import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { Client, Booking } from '@/components/clients/ClientsTypes';

interface BookingDialogsProps {
  isBookingDialogOpen: boolean;
  setIsBookingDialogOpen: (open: boolean) => void;
  isBookingDetailsOpen: boolean;
  setIsBookingDetailsOpen: (open: boolean) => void;
  selectedClient: Client | null;
  selectedBooking: Booking | null;
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  newBooking: {
    time: string;
    title: string;
    description: string;
    notificationEnabled: boolean;
    notificationTime: number;
  };
  setNewBooking: (booking: any) => void;
  timeSlots: string[];
  allBookedDates: Date[];
  handleAddBooking: () => void;
  handleDeleteBooking: (bookingId: number) => void;
  clients: Client[];
}

const BookingDialogs = ({
  isBookingDialogOpen,
  setIsBookingDialogOpen,
  isBookingDetailsOpen,
  setIsBookingDetailsOpen,
  selectedClient,
  selectedBooking,
  selectedDate,
  setSelectedDate,
  newBooking,
  setNewBooking,
  timeSlots,
  allBookedDates,
  handleAddBooking,
  handleDeleteBooking,
  clients,
}: BookingDialogsProps) => {
  return (
    <>
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm flex flex-col p-0" aria-describedby="create-booking-description">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Создать бронирование для {selectedClient?.name}</DialogTitle>
          </DialogHeader>
          <div id="create-booking-description" className="sr-only">
            Форма создания нового бронирования для клиента
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="scale-90 md:scale-100 origin-top">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    modifiers={{
                      booked: allBookedDates,
                    }}
                    modifiersStyles={{
                      booked: {
                        backgroundColor: 'hsl(var(--primary))',
                        color: 'white',
                        fontWeight: 'bold',
                      },
                    }}
                    className="rounded-md border"
                  />
                </div>
                <div className="space-y-2 px-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-primary flex-shrink-0"></div>
                    <span>Даты с бронированиями выделены цветом</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-purple-400 flex-shrink-0"></div>
                    <span>Дата сегодня</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Время</Label>
                  <Select
                    value={newBooking.time}
                    onValueChange={(value) => setNewBooking({ ...newBooking, time: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите время" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(slot => (
                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Что за съёмка</Label>
                  <Input
                    value={newBooking.title}
                    onChange={(e) => setNewBooking({ ...newBooking, title: e.target.value })}
                    placeholder="Например: Фотосессия 9 класса на книгу"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Textarea
                    value={newBooking.description}
                    onChange={(e) => setNewBooking({ ...newBooking, description: e.target.value })}
                    placeholder="Опишите цель встречи"
                    rows={3}
                  />
                </div>
                <div className="space-y-3 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Уведомления на Email</Label>
                      <p className="text-sm text-muted-foreground">
                        Отправить напоминание клиенту
                      </p>
                    </div>
                    <Switch
                      checked={newBooking.notificationEnabled}
                      onCheckedChange={(checked) => setNewBooking({ ...newBooking, notificationEnabled: checked })}
                    />
                  </div>
                  {newBooking.notificationEnabled && (
                    <div className="space-y-2">
                      <Label className="text-sm">Отправить за</Label>
                      <Select
                        value={String(newBooking.notificationTime)}
                        onValueChange={(value) => setNewBooking({ ...newBooking, notificationTime: parseInt(value) })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 час до встречи</SelectItem>
                          <SelectItem value="2">2 часа до встречи</SelectItem>
                          <SelectItem value="3">3 часа до встречи</SelectItem>
                          <SelectItem value="6">6 часов до встречи</SelectItem>
                          <SelectItem value="24">1 день до встречи</SelectItem>
                          <SelectItem value="48">2 дня до встречи</SelectItem>
                          <SelectItem value="168">1 неделю до встречи</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t bg-white/50 backdrop-blur-sm sticky bottom-0">
            <Button onClick={handleAddBooking} className="w-full">
              <Icon name="CalendarCheck" size={18} className="mr-2" />
              Создать бронирование
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBookingDetailsOpen} onOpenChange={setIsBookingDetailsOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm border-2 border-purple-200/50 shadow-2xl" aria-describedby="booking-details-description">
          <DialogHeader className="border-b border-purple-200/30 pb-4">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Детали бронирования
            </DialogTitle>
          </DialogHeader>
          <div id="booking-details-description" className="sr-only">
            Просмотр информации о бронировании клиента
          </div>
          {selectedBooking && (
            <div className="space-y-6 pt-6">
              <div className="space-y-4">
                <div className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-100/50 to-pink-100/50 hover:from-purple-100 hover:to-pink-100 transition-all duration-300 shadow-sm hover:shadow-md">
                  <div className="p-3 bg-gradient-to-br from-purple-200 to-pink-200 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <Icon name="User" size={20} className="text-purple-700" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-600/70 font-medium mb-1">Клиент</p>
                    <p className="font-bold text-lg text-gray-900">
                      {clients.find(c => c.id === selectedBooking.clientId)?.name}
                    </p>
                  </div>
                </div>

                {selectedBooking.title && (
                  <div className="group p-4 rounded-2xl bg-gradient-to-br from-green-100/50 to-emerald-100/50 hover:from-green-100 hover:to-emerald-100 transition-all duration-300 shadow-sm hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-200/50 rounded-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <Icon name="Camera" size={18} className="text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-green-600/70 font-medium mb-1">Что за съёмка</p>
                        <p className="font-bold text-base text-gray-900">{selectedBooking.title}</p>
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
                      {selectedBooking.booking_date 
                        ? new Date(selectedBooking.booking_date).toLocaleDateString('ru-RU')
                        : selectedBooking.date instanceof Date 
                          ? selectedBooking.date.toLocaleDateString('ru-RU') 
                          : selectedBooking.date
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
                    <p className="font-bold text-gray-900">{selectedBooking.booking_time || selectedBooking.time}</p>
                  </div>
                </div>

                {selectedBooking.description && (
                  <div className="group p-4 rounded-2xl bg-gradient-to-r from-amber-100/50 to-orange-100/50 hover:from-amber-100 hover:to-orange-100 transition-all duration-300 shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-amber-200/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                        <Icon name="FileText" size={16} className="text-amber-600" />
                      </div>
                      <p className="text-xs text-amber-600/70 font-medium">Описание</p>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{selectedBooking.description}</p>
                  </div>
                )}

                {(selectedBooking.notification_enabled || selectedBooking.notificationEnabled) && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-cyan-100/50 to-teal-100/50 border border-cyan-200/50">
                    <div className="p-2 bg-cyan-200/50 rounded-lg">
                      <Icon name="Bell" size={16} className="text-cyan-600" />
                    </div>
                    <span className="text-sm font-medium text-cyan-700">
                      Уведомление за {(() => {
                        const time = selectedBooking.notification_time || selectedBooking.notificationTime || 24;
                        if (time >= 24) {
                          const days = time / 24;
                          return `${days} ${days === 1 ? 'день' : days <= 4 ? 'дня' : 'дней'}`;
                        }
                        return `${time} ${time === 1 ? 'час' : time <= 4 ? 'часа' : 'часов'}`;
                      })()}
                    </span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => handleDeleteBooking(selectedBooking.id)}
                className="w-full rounded-xl h-12 bg-gradient-to-r from-red-100 to-rose-100 hover:from-red-200 hover:to-rose-200 text-red-700 hover:text-red-800 border-red-200/50 shadow-md hover:shadow-lg transition-all duration-300 font-semibold group"
              >
                <Icon name="Trash2" size={18} className="mr-2 group-hover:scale-110 transition-transform" />
                Удалить бронирование
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BookingDialogs;