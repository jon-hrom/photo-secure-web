import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Client, Booking } from '@/components/clients/ClientsTypes';

interface ClientsCalendarSectionProps {
  selectedDate: Date | undefined;
  allBookedDates: Date[];
  onDateClick: (date: Date | undefined) => void;
  selectedClient: Client | null;
  onMessageClient: (client: Client) => void;
  clients: Client[];
}

const ClientsCalendarSection = ({
  selectedDate,
  allBookedDates,
  onDateClick,
  selectedClient,
  onMessageClient,
  clients,
}: ClientsCalendarSectionProps) => {
  const upcomingBookings = clients
    .flatMap(c => c.bookings.map(b => ({ ...b, client: c })))
    .filter(b => b.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Calendar" className="text-primary" />
            Календарь бронирований
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onDateClick}
            modifiers={{
              booked: (date) => {
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
                backgroundColor: 'hsl(var(--primary))',
                color: 'white',
                fontWeight: 'bold',
              },
            }}
            className="rounded-md border"
          />
          <div className="mt-4 p-3 bg-blue-50 rounded-xl border-2 border-blue-200">
            <p className="text-sm text-blue-700 flex items-center gap-2">
              <Icon name="Info" size={16} />
              Даты с бронированиями отмечены цветом
            </p>
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="User" className="text-primary" />
              Выбранный клиент
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="font-semibold text-lg">{selectedClient.name}</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Icon name="Phone" size={16} className="text-muted-foreground" />
                  <span>{selectedClient.phone}</span>
                </div>
                {selectedClient.email && (
                  <div className="flex items-center gap-2">
                    <Icon name="Mail" size={16} className="text-muted-foreground" />
                    <span>{selectedClient.email}</span>
                  </div>
                )}
              </div>
            </div>
            {selectedClient.bookings.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-medium">Бронирования:</p>
                {selectedClient.bookings.map(booking => (
                  <div key={booking.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon name="Calendar" size={14} className="text-primary" />
                      <span>
                        {booking.date instanceof Date ? booking.date.toLocaleDateString('ru-RU') : booking.date} в {booking.time}
                      </span>
                    </div>
                    <Badge variant={booking.date >= new Date() ? 'default' : 'secondary'}>
                      {booking.date >= new Date() ? 'Активно' : 'Завершено'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <div
              className="mt-4 p-3 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl cursor-pointer hover:from-primary/20 hover:to-secondary/20 transition-all"
              onClick={() => onMessageClient(selectedClient)}
            >
              <p className="text-sm font-medium text-center flex items-center justify-center gap-2">
                <Icon name="MessageCircle" size={16} />
                Написать сообщение
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {upcomingBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Calendar" className="text-primary" />
              Ближайшие встречи
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-semibold text-muted-foreground">ФИО</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-muted-foreground">Дата</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-muted-foreground">Время</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-muted-foreground">Локация</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-2 font-medium text-sm">{booking.client.name}</td>
                      <td className="py-3 px-2 text-sm">
                        {booking.date instanceof Date ? booking.date.toLocaleDateString('ru-RU') : booking.date}
                      </td>
                      <td className="py-3 px-2 text-sm">{booking.time}</td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {booking.location || booking.description || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientsCalendarSection;