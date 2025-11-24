import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import StorageWarning from '@/components/StorageWarning';
import DashboardUserCard from '@/components/dashboard/DashboardUserCard';
import DashboardStatistics from '@/components/dashboard/DashboardStatistics';
import DashboardMeetings from '@/components/dashboard/DashboardMeetings';
import { isAdminUser } from '@/utils/adminCheck';

interface DashboardProps {
  userRole: 'user' | 'admin' | 'guest';
  userId?: string | null;
  onOpenClientBooking?: (clientName: string) => void;
  onLogout?: () => void;
  onOpenAdminPanel?: () => void;
  isAdmin?: boolean;
  onOpenTariffs?: () => void;
  onNavigateToClients?: () => void;
  onNavigateToPhotobook?: () => void;
  onOpenAddClient?: () => void;
}

const Dashboard = ({ userRole, userId: propUserId, onOpenClientBooking, onLogout, onOpenAdminPanel, isAdmin, onOpenTariffs, onNavigateToClients, onNavigateToPhotobook, onOpenAddClient }: DashboardProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [trialDaysLeft] = useState(14);
  const [subscriptionDaysLeft] = useState(0);
  const [balance] = useState(0);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Array<{
    id: number;
    name: string;
    date: string;
    time: string;
    type: string;
  }>>([]);
  const [storageUsage, setStorageUsage] = useState({ usedGb: 0, limitGb: 5, percent: 0, plan_name: 'Старт', plan_id: 1 });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchMeetings = async () => {
      const userId = propUserId || localStorage.getItem('userId');
      if (!userId) {
        console.log('[MEETINGS] No userId available');
        return;
      }
      
      try {
        const res = await fetch(`https://functions.poehali.dev/c9c95946-cd1a-45f3-ad47-9390b5e1b47b?userId=${userId}`);
        const appointments = await res.json();
        
        const formatted = appointments
          .filter((apt: any) => new Date(apt.date) >= new Date())
          .slice(0, 6)
          .map((apt: any) => {
            const meetingDate = new Date(apt.date);
            return {
              id: apt.id,
              name: apt.clientName || 'Без имени',
              date: meetingDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
              time: meetingDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              type: apt.title || apt.description || 'Встреча'
            };
          });
        
        setUpcomingMeetings(formatted);
      } catch (error) {
        console.error('Failed to load meetings:', error);
      }
    };
    
    fetchMeetings();
    
    // Автообновление встреч каждые 30 секунд
    const intervalId = setInterval(fetchMeetings, 30000);
    
    // Обновление при возврате на страницу (например, из раздела "Клиенты")
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMeetings();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [propUserId]);

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

  const handleMeetingClick = (clientName: string) => {
    if (onOpenClientBooking) {
      onOpenClientBooking(clientName);
    }
  };

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
      <Card 
        className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-0 shadow-xl cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group"
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
      <StorageWarning />
      
      <DashboardUserCard 
        vkUser={vkUser}
        emailUser={emailUser}
        finalIsAdmin={finalIsAdmin}
        onOpenAdminPanel={onOpenAdminPanel}
        onLogout={onLogout}
      />
      
      <Card className="bg-gradient-to-br from-primary to-secondary text-white border-0 shadow-xl">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <Icon name="Clock" size={48} className="opacity-30 hidden sm:block md:w-16 md:h-16" />
              <div>
                <h2 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">{formatTime(currentTime)}</h2>
                <p className="text-sm md:text-lg opacity-90 capitalize font-light">{formatDate(currentTime)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
              <button 
                onClick={onOpenAddClient}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="UserPlus" size={18} className="transition-transform duration-300 group-hover:rotate-12 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium hidden sm:inline">Добавить клиента</span>
              </button>
              <button 
                onClick={() => onOpenClientBooking?.('')}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="Calendar" size={18} className="transition-transform duration-300 group-hover:rotate-12 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium hidden sm:inline">Новая запись</span>
              </button>
              <button 
                onClick={onNavigateToPhotobook}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="BookOpen" size={18} className="transition-transform duration-300 group-hover:rotate-12 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium hidden sm:inline">Создать фотокнигу</span>
              </button>
              <button 
                onClick={onNavigateToClients}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="FileText" size={18} className="transition-transform duration-300 group-hover:rotate-12 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium hidden sm:inline">Отчёты</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <DashboardStatistics 
        trialDaysLeft={trialDaysLeft}
        subscriptionDaysLeft={subscriptionDaysLeft}
        isTrialPeriod={isTrialPeriod}
      />

      {upcomingMeetings.length > 0 && upcomingMeetings[0] && (
        <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 to-secondary/5 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
              <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                <div className="bg-primary/10 p-2 md:p-3 rounded-full animate-pulse">
                  <Icon name="Bell" size={20} className="text-primary md:w-6 md:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm md:text-base text-primary">Ближайшая встреча</p>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">{upcomingMeetings[0].name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
                <div className="flex flex-col sm:items-end flex-1 sm:flex-none">
                  <p className="text-xs md:text-sm font-medium">{upcomingMeetings[0].date}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">{upcomingMeetings[0].time}</p>
                </div>
                <button
                  onClick={() => handleMeetingClick(upcomingMeetings[0].name)}
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-xs md:text-sm font-medium whitespace-nowrap"
                >
                  Открыть
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <DashboardMeetings 
        upcomingMeetings={upcomingMeetings}
        onMeetingClick={handleMeetingClick}
      />


    </div>
  );
};

export default Dashboard;