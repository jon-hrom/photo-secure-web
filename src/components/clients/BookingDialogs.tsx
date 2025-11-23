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
    description: string;
    notificationEnabled: boolean;
    notificationTime: number;
  };
  setNewBooking: (booking: any) => void;
  timeSlots: string[];
  allBookedDates: Date[];
  handleDateClick: (date: Date | undefined) => void;
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
  handleDateClick,
  handleAddBooking,
  handleDeleteBooking,
  clients,
}: BookingDialogsProps) => {
  return (
    <>
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Создать бронирование для {selectedClient?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div>
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
                <Label>Описание</Label>
                <Textarea
                  value={newBooking.description}
                  onChange={(e) => setNewBooking({ ...newBooking, description: e.target.value })}
                  placeholder="Опишите цель встречи"
                  rows={4}
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
              <Button onClick={handleAddBooking} className="w-full">
                <Icon name="CalendarCheck" size={18} className="mr-2" />
                Создать бронирование
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBookingDetailsOpen} onOpenChange={setIsBookingDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Детали бронирования</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 pt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon name="User" size={18} className="text-muted-foreground" />
                  <span className="font-medium">
                    {clients.find(c => c.id === selectedBooking.clientId)?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="Calendar" size={18} className="text-muted-foreground" />
                  <span>{selectedBooking.date instanceof Date ? selectedBooking.date.toLocaleDateString('ru-RU') : selectedBooking.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="Clock" size={18} className="text-muted-foreground" />
                  <span>{selectedBooking.time}</span>
                </div>
                {selectedBooking.description && (
                  <div className="flex items-start gap-2">
                    <Icon name="FileText" size={18} className="text-muted-foreground mt-1" />
                    <p className="text-sm">{selectedBooking.description}</p>
                  </div>
                )}
                {selectedBooking.notificationEnabled && (
                  <Badge variant="secondary">
                    <Icon name="Bell" size={12} className="mr-1" />
                    Уведомление за {selectedBooking.notificationTime >= 24 
                      ? `${selectedBooking.notificationTime / 24} ${selectedBooking.notificationTime === 24 ? 'день' : selectedBooking.notificationTime === 48 ? 'дня' : 'недель'}`
                      : `${selectedBooking.notificationTime} ${selectedBooking.notificationTime === 1 ? 'час' : selectedBooking.notificationTime <= 4 ? 'часа' : 'часов'}`}
                  </Badge>
                )}
              </div>
              <Button
                variant="destructive"
                onClick={() => handleDeleteBooking(selectedBooking.id)}
                className="w-full"
              >
                <Icon name="Trash2" size={18} className="mr-2" />
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