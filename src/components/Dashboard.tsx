import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import StorageWarning from '@/components/StorageWarning';
import DashboardUserCard from '@/components/dashboard/DashboardUserCard';
import DashboardCalendar from '@/components/dashboard/DashboardCalendar';
import DashboardBookingDetailsDialog from '@/components/dashboard/DashboardBookingDetailsDialog';
import DashboardUpcomingBookings from '@/components/dashboard/DashboardUpcomingBookings';
import { Client } from '@/components/clients/ClientsTypes';
import { isAdminUser } from '@/utils/adminCheck';

interface DashboardProps {
  userRole: 'user' | 'admin' | 'guest';
  userId?: string | null;
  clients?: Client[];
  onOpenClientBooking?: (clientName: string) => void;
  onMeetingClick?: (meetingId: number) => void;
  onLogout?: () => void;
  onOpenAdminPanel?: () => void;
  isAdmin?: boolean;
  onOpenTariffs?: () => void;
  onNavigateToClients?: () => void;
  onNavigateToPhotobook?: () => void;
  onOpenAddClient?: () => void;
}

const Dashboard = ({ userRole, userId: propUserId, clients: propClients = [], onOpenClientBooking, onMeetingClick, onLogout, onOpenAdminPanel, isAdmin, onOpenTariffs, onNavigateToClients, onNavigateToPhotobook, onOpenAddClient }: DashboardProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [trialDaysLeft] = useState(14);
  const [subscriptionDaysLeft] = useState(0);
  const [balance] = useState(0);

  const [storageUsage, setStorageUsage] = useState({ usedGb: 0, limitGb: 5, percent: 0, plan_name: 'Старт', plan_id: 1 });
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bookings = propClients
      .flatMap((client: Client) => 
        (client.bookings || []).map(b => {
          const bookingDate = new Date(b.booking_date || b.date);
          return {
            ...b,
            date: bookingDate,
            time: b.booking_time || b.time,
            client
          };
        })
      )
      .filter((b: any) => {
        const bookingDate = new Date(b.date);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate >= today;
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 7);

    setUpcomingBookings(bookings);
  }, [propClients]);



  useEffect(() => {
    const fetchStorageUsage = async () => {
      const userId = propUserId || localStorage.getItem('userId');
      if (!userId) {
        console.log('[STORAGE] No userId, skipping storage fetch');
        setStorageUsage({ usedGb: 0, limitGb: 5, percent: 0, plan_name: 'Старт', plan_id: 1 });
        return;
      }
      
      try {
        console.log('[STORAGE] Fetching storage for userId:', userId);
        const res = await fetch('https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985?action=usage', {
          headers: { 'X-User-Id': userId }
        });
        
        console.log('[STORAGE] Response status:', res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[STORAGE] API error:', res.status, errorText);
          setStorageUsage({ usedGb: 0, limitGb: 5, percent: 0, plan_name: 'Старт', plan_id: 1 });
          return;
        }
        
        const data = await res.json();
        console.log('[STORAGE] Received data:', JSON.stringify(data));
        setStorageUsage({
          usedGb: data.usedGb || 0,
          limitGb: data.limitGb || 5,
          percent: data.percent || 0,
          plan_name: data.plan_name || 'Старт',
          plan_id: data.plan_id || 1
        });
      } catch (error) {
        console.error('[STORAGE] Failed to fetch storage usage:', error);
        setStorageUsage({ usedGb: 0, limitGb: 5, percent: 0, plan_name: 'Старт', plan_id: 1 });
      }
    };
    
    fetchStorageUsage();
    const interval = setInterval(fetchStorageUsage, 30000);
    return () => clearInterval(interval);
  }, [propUserId]);

  const formatDate = (date: Date) => {
    const formatted = new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
    return formatted.replace(' г.', '');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const isTrialPeriod = trialDaysLeft > 0 && subscriptionDaysLeft === 0;



  // Мемоизируем данные пользователя чтобы избежать лишних парсингов при каждом рендере
  const { vkUser, emailUser, userEmail, finalIsAdmin } = useMemo(() => {
    const vkUserData = localStorage.getItem('vk_user');
    const vkUser = vkUserData ? JSON.parse(vkUserData) : null;
    
    const savedSession = localStorage.getItem('authSession');
    const emailUser = savedSession ? JSON.parse(savedSession) : null;
    const userEmail = emailUser?.email || vkUser?.email;
    
    const finalIsAdmin = isAdmin || isAdminUser(userEmail, vkUser);
    
    return { vkUser, emailUser, userEmail, finalIsAdmin };
  }, [isAdmin]); // Пересчитываем только если isAdmin изменился

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in-up px-3 sm:px-0">
      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="bg-gradient-to-br from-primary to-secondary text-white border-0 shadow-xl w-full lg:w-1/2">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              {(() => {
                const displayUser = vkUser || emailUser;
                const displayName = displayUser?.name || displayUser?.userEmail || displayUser?.email || 'Пользователь';
                const displayEmail = displayUser?.email || displayUser?.userEmail || 'Вход через почту';
                const displayAvatar = displayUser?.avatar || null;
                const displayVerified = displayUser?.is_verified || displayUser?.verified || false;
                
                return (
                  <div className="flex items-start gap-3">
                    {displayAvatar && (
                      <div className="relative flex-shrink-0">
                        <img 
                          src={displayAvatar} 
                          alt={displayName}
                          className="w-12 h-12 rounded-full border-3 border-white shadow-lg object-cover"
                        />
                        {displayVerified && (
                          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
                            <Icon name="BadgeCheck" size={12} className="text-blue-500" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h3 className="text-base font-bold truncate">{displayName}</h3>
                            {displayVerified && (
                              <Icon name="BadgeCheck" size={14} className="text-white" />
                            )}
                          </div>
                          <p className="text-xs opacity-75 truncate">{displayEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon name="Clock" size={32} className="opacity-30" />
                        <div>
                          <h2 className="text-xl md:text-2xl font-bold leading-tight">{formatTime(currentTime)}</h2>
                          <p className="text-xs opacity-75 capitalize">{formatDate(currentTime)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap w-full lg:w-auto justify-end">
              {finalIsAdmin && onOpenAdminPanel && (
                <button
                  onClick={onOpenAdminPanel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
                  title="Админ-панель"
                >
                  <Icon name="ShieldCheck" size={16} className="text-white" />
                  <span className="text-xs font-medium">Админка</span>
                </button>
              )}
              <button 
                onClick={onOpenAddClient}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="UserPlus" size={16} className="transition-transform duration-300 group-hover:rotate-12" />
                <span className="text-xs font-medium hidden sm:inline">Добавить клиента</span>
              </button>
              <button 
                onClick={onNavigateToPhotobook}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="BookOpen" size={16} className="transition-transform duration-300 group-hover:rotate-12" />
                <span className="text-xs font-medium hidden sm:inline">Создать фотокнигу</span>
              </button>
              <button 
                onClick={onNavigateToClients}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="FileText" size={16} className="transition-transform duration-300 group-hover:rotate-12" />
                <span className="text-xs font-medium hidden sm:inline">Отчёты</span>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
                  title="Выйти"
                >
                  <Icon name="LogOut" size={16} className="text-white" />
                  <span className="text-xs font-medium hidden sm:inline">Выйти</span>
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
        
        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-0 shadow-xl cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group w-full lg:w-1/2"
          onClick={() => onOpenTariffs?.()}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="pt-4 md:pt-6 relative z-10">
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Icon name="HardDrive" size={18} className="text-white md:w-5 md:h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base md:text-lg">Фото банк</h3>
                    <Badge variant="outline" className="text-xs mt-1 bg-white/50 backdrop-blur-sm">{storageUsage.plan_name}</Badge>
                  </div>
                </div>
                <Badge 
                  variant={storageUsage.percent >= 90 ? 'destructive' : storageUsage.percent >= 70 ? 'default' : 'secondary'}
                  className="text-xs md:text-sm font-bold px-2 md:px-3 py-0.5 md:py-1 shadow-md"
                >
                  {(storageUsage.percent || 0).toFixed(1)}%
                </Badge>
              </div>
              <Progress 
                value={storageUsage.percent || 0} 
                className="h-3 md:h-4 transition-all duration-500 ease-out shadow-inner"
              />
              <div className="flex justify-between text-xs md:text-sm font-medium text-muted-foreground">
                <span>{(storageUsage.usedGb || 0).toFixed(2)} ГБ использовано</span>
                <span>{(storageUsage.limitGb || 5).toFixed(0)} ГБ доступно</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <StorageWarning />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardCalendar 
          clients={propClients}
          onBookingClick={(client, booking) => {
            setSelectedClient(client);
            setSelectedBooking(booking);
            setIsBookingDetailsOpen(true);
          }}
        />
        
        <DashboardUpcomingBookings
          bookings={upcomingBookings}
          onBookingClick={(client, booking) => {
            setSelectedClient(client);
            setSelectedBooking(booking);
            setIsBookingDetailsOpen(true);
          }}
        />
      </div>

      <DashboardBookingDetailsDialog
        open={isBookingDetailsOpen}
        onOpenChange={setIsBookingDetailsOpen}
        client={selectedClient}
        booking={selectedBooking}
      />

    </div>
  );
};

export default Dashboard;