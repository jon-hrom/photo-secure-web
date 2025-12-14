import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Message, Booking, Project } from '@/components/clients/ClientsTypes';

interface MessageHistoryProps {
  messages: Message[];
  bookings: Booking[];
  projects?: Project[];
  formatDateTime: (dateString: string) => string;
}

const MessageHistory = ({ messages, bookings, projects = [], formatDateTime }: MessageHistoryProps) => {
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
              {pastBookings.map((booking, index) => {
                const bookingDate = new Date(booking.booking_date || booking.date);
                const relatedProject = projects.find(p => p.name === booking.title);
                
                return (
                  <div key={booking.id} className="border rounded-lg p-4 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                          {pastBookings.length - index}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Icon name="CalendarCheck" size={16} className="text-blue-600 flex-shrink-0" />
                              <span className="text-sm font-semibold text-gray-900">
                                {relatedProject ? relatedProject.name : (booking.title || 'Встреча')}
                              </span>
                              {relatedProject && (
                                <Badge variant="outline" className="text-xs">
                                  Проект
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <Icon name="Clock" size={12} />
                              {bookingDate.toLocaleDateString('ru-RU', { 
                                day: '2-digit', 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                              {' в '}
                              {booking.booking_time || booking.time}
                            </div>
                          </div>
                        </div>
                        {booking.description && (
                          <p className="text-sm text-muted-foreground mt-2">{booking.description}</p>
                        )}
                        {booking.location && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Icon name="MapPin" size={12} />
                            {booking.location}
                          </div>
                        )}
                      </div>
                    </div>
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