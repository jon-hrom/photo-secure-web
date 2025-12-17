import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Client, Booking } from '@/components/clients/ClientsTypes';

interface ClientsCalendarSectionProps {
  selectedDate: Date | undefined;
  allBookedDates: Date[];
  onDateClick: (date: Date | undefined) => void;
  onDateLongPress: (date: Date | undefined) => void;
  selectedClient: Client | null;
  onMessageClient: (client: Client) => void;
  clients: Client[];
}

const ClientsCalendarSection = ({
  selectedDate,
  allBookedDates,
  onDateClick,
  onDateLongPress,
  selectedClient,
  onMessageClient,
  clients,
}: ClientsCalendarSectionProps) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Состояние для долгого нажатия
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [pressedDate, setPressedDate] = useState<Date | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Обработчик начала нажатия (мышь)
  const handleMouseDown = (date: Date) => {
    setIsLongPressing(true);
    setPressedDate(date);
    
    longPressTimer.current = setTimeout(() => {
      // Долгое нажатие сработало
      setIsLongPressing(false);
      setPressedDate(null);
      onDateLongPress(date);
    }, 600);
  };

  // Обработчик отпускания (мышь)
  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    // Если это был быстрый клик (не долгое нажатие)
    if (isLongPressing && pressedDate) {
      onDateClick(pressedDate);
    }
    
    setIsLongPressing(false);
    setPressedDate(null);
  };

  // Обработчик начала касания (тач)
  const handleTouchStart = (date: Date, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    setIsLongPressing(true);
    setPressedDate(date);
    
    longPressTimer.current = setTimeout(() => {
      // Долгое нажатие сработало
      setIsLongPressing(false);
      setPressedDate(null);
      
      // Вибрация для тактильной обратной связи
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      onDateLongPress(date);
    }, 600);
  };

  // Обработчик движения пальца (отменяем долгое нажатие при скролле)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // Если палец сдвинулся больше чем на 10px - отменяем долгое нажатие
    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      setIsLongPressing(false);
      setPressedDate(null);
    }
  };

  // Обработчик окончания касания (тач)
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    // Если это было быстрое касание (не долгое нажатие)
    if (isLongPressing && pressedDate) {
      onDateClick(pressedDate);
    }
    
    setIsLongPressing(false);
    setPressedDate(null);
    touchStartPos.current = null;
  };

  const upcomingBookings = clients
    .flatMap(c => c.bookings.map(b => ({ ...b, client: c })))
    .filter(b => b.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 8);

  const todayBookings = clients
    .flatMap(c => c.bookings.map(b => ({ ...b, client: c })))
    .filter(b => {
      const bookingDate = new Date(b.date);
      bookingDate.setHours(0, 0, 0, 0);
      return bookingDate.getTime() === today.getTime();
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const getBookingStats = () => {
    const total = upcomingBookings.length;
    const thisWeek = upcomingBookings.filter(b => {
      const bookingDate = new Date(b.date);
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      return bookingDate <= weekFromNow;
    }).length;
    return { total, thisWeek };
  };

  const stats = getBookingStats();

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-100 via-pink-50 to-rose-100 p-6 shadow-md hover:shadow-xl transition-all duration-500 hover:scale-105 cursor-pointer border border-purple-200/50 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-purple-200/40 backdrop-blur-sm rounded-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                <Icon name="Calendar" size={24} className="text-purple-500" />
              </div>
              <div className="text-purple-600/70 text-sm font-medium">На неделе</div>
            </div>
            <div className="text-purple-700">
              <div className="text-4xl font-bold mb-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {stats.thisWeek}
              </div>
              <div className="text-purple-600/70 text-sm px-[1px] mx-1">     встреч 
запланировано</div>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-purple-200/20 rounded-full blur-2xl group-hover:scale-150 group-hover:bg-purple-300/30 transition-all duration-700" />
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 via-cyan-50 to-teal-100 p-6 shadow-md hover:shadow-xl transition-all duration-500 hover:scale-105 cursor-pointer border border-blue-200/50 animate-in fade-in slide-in-from-right-8 duration-700 delay-150">
          <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-blue-200/40 backdrop-blur-sm rounded-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                <Icon name="Users" size={24} className="text-blue-500" />
              </div>
              <div className="text-blue-600/70 text-sm font-medium mx-5 my-0 px-5 py-0 rounded-0">Всего
в этом месяце</div>
            </div>
            <div className="text-blue-700">
              <div className="text-4xl font-bold mb-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                {stats.total}
              </div>
              <div className="text-blue-600/70 text-sm">активных записей</div>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-200/20 rounded-full blur-2xl group-hover:scale-150 group-hover:bg-blue-300/30 transition-all duration-700" />
        </div>
      </div>

      {/* Calendar Card */}
      <Card className="overflow-hidden border border-purple-200/50 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
        <div className="bg-gradient-to-r from-purple-100 via-pink-50 to-rose-100 p-6">
          <CardTitle className="flex items-center gap-3 text-purple-700">
            <div className="p-2 bg-purple-200/40 backdrop-blur-sm rounded-lg">
              <Icon name="Calendar" size={24} className="text-purple-600" />
            </div>
            <div>
              <div className="text-xl font-bold">Календарь бронирований</div>
              <div className="text-purple-600/70 text-sm font-normal">Выберите дату для просмотра записей</div>
            </div>
          </CardTitle>
        </div>
        <CardContent className="p-6">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 shadow-inner">
            <div
              onMouseDown={(e) => {
                const target = e.target as HTMLElement;
                const button = target.closest('button[name^="day-"]');
                if (button) {
                  const dayAttr = button.getAttribute('name');
                  if (dayAttr) {
                    const dateStr = dayAttr.replace('day-', '');
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                      handleMouseDown(date);
                    }
                  }
                }
              }}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={(e) => {
                const target = e.target as HTMLElement;
                const button = target.closest('button[name^="day-"]');
                if (button) {
                  const dayAttr = button.getAttribute('name');
                  if (dayAttr) {
                    const dateStr = dayAttr.replace('day-', '');
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                      handleTouchStart(date, e);
                    }
                  }
                }
              }}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={isLongPressing && pressedDate ? 'animate-pulse-strong' : ''}
            >
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={() => {}} // Отключаем стандартный обработчик, используем свои
                modifiers={{
                  booked: (date) => {
                    const checkDate = new Date(date);
                    checkDate.setHours(0, 0, 0, 0);
                    
                    if (checkDate < today) {
                      return false;
                    }
                    
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
                    background: 'linear-gradient(135deg, rgb(216 180 254) 0%, rgb(251 207 232) 100%)',
                    color: 'rgb(107 33 168)',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 15px -3px rgba(216, 180, 254, 0.3)',
                    transform: 'scale(1.05)',
                    transition: 'all 0.3s ease',
                  },
                }}
                className="rounded-xl border-0 w-full"
              />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 shadow-md flex-shrink-0"></div>
              <p className="text-sm text-gray-700 font-medium">Даты с бронированиями</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-400 shadow-md flex-shrink-0"></div>
              <p className="text-sm text-gray-700 font-medium">Дата сегодня</p>
            </div>
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <p className="text-xs text-purple-700 font-medium text-center">
                👆 Клик — просмотр • 🖊️ Зажать — редактирование
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Bookings */}
      {todayBookings.length > 0 && (
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
                className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-white to-gray-50 p-4 border border-gray-200 hover:border-purple-300 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-left-4"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-100/0 to-pink-100/0 group-hover:from-purple-100/50 group-hover:to-pink-100/50 transition-all duration-300" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center text-purple-700 font-bold text-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                      {booking.client.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{booking.client.name}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1.5">
                        <Icon name="Clock" size={14} className="text-purple-500" />
                        {booking.time}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="rounded-lg hover:bg-purple-50 hover:text-purple-600"
                    onClick={() => onMessageClient(booking.client)}
                  >
                    <Icon name="MessageCircle" size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Selected Client Card */}
      {selectedClient && (
        <Card className="overflow-hidden border border-emerald-200/50 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in zoom-in duration-500">
          <div className="bg-gradient-to-r from-emerald-100 via-teal-50 to-cyan-100 p-5">
            <CardTitle className="flex items-center gap-3 text-emerald-700">
              <div className="p-2 bg-emerald-200/40 backdrop-blur-sm rounded-lg">
                <Icon name="UserCheck" size={20} className="text-emerald-600" />
              </div>
              <div className="text-lg font-bold">Выбранный клиент</div>
            </CardTitle>
          </div>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-200 to-cyan-200 flex items-center justify-center text-emerald-700 font-bold text-2xl shadow-md animate-in zoom-in duration-500">
                {selectedClient.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-xl text-gray-900">{selectedClient.name}</p>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Icon name="Phone" size={14} className="text-emerald-500" />
                    <span>{selectedClient.phone}</span>
                  </div>
                  {selectedClient.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Icon name="Mail" size={14} className="text-emerald-500" />
                      <span>{selectedClient.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedClient.messages && selectedClient.messages.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Icon name="MessageSquare" size={16} className="text-emerald-500" />
                  История переписки
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedClient.messages
                    .slice()
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 5)
                    .map((message, index) => {
                      const isFromClient = message.author.toLowerCase() === 'клиент' || 
                                          message.author.toLowerCase() === selectedClient.name.toLowerCase();
                      return (
                        <div 
                          key={message.id} 
                          className="p-3 rounded-xl bg-gradient-to-r from-emerald-50/50 to-cyan-50/50 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-right-4"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex items-start gap-2">
                            <Icon 
                              name={isFromClient ? "User" : "UserCheck"} 
                              size={14} 
                              className={isFromClient ? "text-blue-500 mt-0.5" : "text-emerald-500 mt-0.5"} 
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-semibold ${isFromClient ? 'text-blue-700' : 'text-emerald-700'}`}>
                                  {isFromClient ? selectedClient.name : message.author}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(message.date).toLocaleString('ru-RU', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {message.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {selectedClient.bookings.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Icon name="Calendar" size={16} className="text-emerald-500" />
                  Бронирования
                </p>
                <div className="space-y-2">
                  {selectedClient.bookings.map((booking, index) => (
                    <div 
                      key={booking.id} 
                      className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-50/50 to-cyan-50/50 hover:from-emerald-100/50 hover:to-cyan-100/50 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-right-4"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Icon name="CalendarCheck" size={14} className="text-emerald-500" />
                        <span className="font-medium">
                          {booking.date instanceof Date ? booking.date.toLocaleDateString('ru-RU') : booking.date}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-600">{booking.time}</span>
                      </div>
                      <Badge 
                        variant={booking.date >= new Date() ? 'default' : 'secondary'}
                        className="animate-in fade-in zoom-in duration-300"
                      >
                        {booking.date >= new Date() ? '✓ Активно' : 'Завершено'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => onMessageClient(selectedClient)}
              className="w-full mt-4 bg-gradient-to-r from-emerald-200 to-cyan-200 hover:from-emerald-300 hover:to-cyan-300 text-emerald-700 hover:text-emerald-800 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl h-12 font-semibold group"
            >
              <Icon name="MessageCircle" size={18} className="mr-2 group-hover:scale-110 transition-transform" />
              Написать сообщение
            </Button>
            <Button
              onClick={() => {
                if (selectedClient.phone) {
                  window.open(`tel:${selectedClient.phone}`, '_self');
                }
              }}
              className="w-full mt-3 bg-gradient-to-r from-emerald-200 to-cyan-200 hover:from-emerald-300 hover:to-cyan-300 text-emerald-700 hover:text-emerald-800 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl h-12 font-semibold group"
            >
              <Icon name="Phone" size={18} className="mr-2 group-hover:scale-110 transition-transform" />
              Позвонить
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Bookings */}
      {upcomingBookings.length > 0 && (
        <Card className="overflow-hidden border border-indigo-200/50 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-600">
          <div className="bg-gradient-to-r from-indigo-100 via-blue-50 to-cyan-100 p-5">
            <CardTitle className="flex items-center gap-3 text-indigo-700">
              <div className="p-2 bg-indigo-200/40 backdrop-blur-sm rounded-lg">
                <Icon name="CalendarDays" size={20} className="text-indigo-600" />
              </div>
              <div className="text-lg font-bold">Ближайшие встречи</div>
            </CardTitle>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {upcomingBookings.map((booking, index) => (
                <div
                  key={booking.id}
                  className="group p-4 hover:bg-gradient-to-r hover:from-indigo-50/70 hover:to-blue-50/70 transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => onMessageClient(booking.client)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-200 to-blue-200 flex items-center justify-center text-indigo-700 font-bold shadow-sm group-hover:scale-110 transition-transform duration-300">
                        {booking.client.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{booking.client.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Icon name="Calendar" size={12} className="text-indigo-500" />
                            {booking.date instanceof Date ? booking.date.toLocaleDateString('ru-RU') : booking.date}
                          </span>
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Icon name="Clock" size={12} className="text-indigo-500" />
                            {booking.time}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Icon name="ChevronRight" size={20} className="text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientsCalendarSection;