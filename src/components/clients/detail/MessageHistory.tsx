import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Message, Booking } from '@/components/clients/ClientsTypes';

interface MessageHistoryProps {
  messages: Message[];
  bookings: Booking[];
  formatDateTime: (dateString: string) => string;
}

const MessageHistory = ({ messages, bookings, formatDateTime }: MessageHistoryProps) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastBookings = bookings
    .filter(b => {
      const bookingDate = new Date(b.booking_date || b.date);
      bookingDate.setHours(0, 0, 0, 0);
      return bookingDate < today;
    })
    .sort((a, b) => {
      const dateA = new Date(a.booking_date || a.date);
      const dateB = new Date(b.booking_date || b.date);
      return dateB.getTime() - dateA.getTime();
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>История взаимодействий</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {pastBookings.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Icon name="Calendar" size={16} />
              Прошедшие встречи
            </h3>
            <div className="space-y-3">
              {pastBookings.map((booking) => {
                const bookingDate = new Date(booking.booking_date || booking.date);
                return (
                  <div key={booking.id} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Icon name="CalendarCheck" size={16} className="text-blue-600" />
                        <span className="text-sm font-medium">{booking.title || 'Встреча'}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {bookingDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' • '}
                        {booking.booking_time || booking.time}
                      </span>
                    </div>
                    {booking.description && (
                      <p className="text-sm text-muted-foreground">{booking.description}</p>
                    )}
                    {booking.location && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Icon name="MapPin" size={12} />
                        {booking.location}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Icon name="MessageSquare" size={16} />
              Сообщения
            </h3>
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon
                      name={
                        msg.type === 'email' ? 'Mail' :
                        msg.type === 'vk' ? 'MessageCircle' :
                        msg.type === 'phone' ? 'Phone' : 'Users'
                      }
                      size={16}
                      className="text-primary"
                    />
                    <span className="text-sm font-medium">{msg.author}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(msg.date)}
                    </span>
                  </div>
                  <p className="text-sm">{msg.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && pastBookings.length === 0 ? (
          <div className="text-center py-8">
            <Icon name="History" size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">История пуста</p>
            <p className="text-sm text-muted-foreground mt-1">
              Здесь будет отображаться история встреч и общения с клиентом
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default MessageHistory;