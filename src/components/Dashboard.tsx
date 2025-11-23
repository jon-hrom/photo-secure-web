import { useEffect, useState } from 'react';
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

  const vkUserData = localStorage.getItem('vk_user');
  const vkUser = vkUserData ? JSON.parse(vkUserData) : null;
  
  const savedSession = localStorage.getItem('authSession');
  const emailUser = savedSession ? JSON.parse(savedSession) : null;
  const userEmail = emailUser?.email || vkUser?.email;
  
  console.log('[DASHBOARD] Admin check:', {
    isAdmin,
    userEmail,
    vkUser,
    isAdminUserResult: isAdminUser(userEmail, vkUser)
  });
  
  const finalIsAdmin = isAdmin || isAdminUser(userEmail, vkUser);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <Card 
        className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-0 shadow-xl cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group"
        onClick={() => onOpenTariffs?.()}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <CardContent className="pt-6 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Icon name="HardDrive" size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Фото банк</h3>
                  <Badge variant="outline" className="text-xs mt-1 bg-white/50 backdrop-blur-sm">{storageUsage.plan_name}</Badge>
                </div>
              </div>
              <Badge 
                variant={storageUsage.percent >= 90 ? 'destructive' : storageUsage.percent >= 70 ? 'default' : 'secondary'}
                className="text-sm font-bold px-3 py-1 shadow-md"
              >
                {(storageUsage.percent || 0).toFixed(1)}%
              </Badge>
            </div>
            <Progress 
              value={storageUsage.percent || 0} 
              className="h-4 transition-all duration-500 ease-out shadow-inner"
            />
            <div className="flex justify-between text-sm font-medium text-muted-foreground">
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
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Icon name="Clock" size={64} className="opacity-30 hidden sm:block" />
              <div>
                <h2 className="text-4xl font-bold mb-2">{formatTime(currentTime)}</h2>
                <p className="text-lg opacity-90 capitalize font-light">{formatDate(currentTime)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={onOpenAddClient}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="UserPlus" size={20} className="transition-transform duration-300 group-hover:rotate-12" />
                <span className="text-sm font-medium hidden sm:inline">Добавить клиента</span>
              </button>
              <button 
                onClick={() => onOpenClientBooking?.('')}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="Calendar" size={20} className="transition-transform duration-300 group-hover:rotate-12" />
                <span className="text-sm font-medium hidden sm:inline">Новая запись</span>
              </button>
              <button 
                onClick={onNavigateToPhotobook}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="BookOpen" size={20} className="transition-transform duration-300 group-hover:rotate-12" />
                <span className="text-sm font-medium hidden sm:inline">Создать фотокнигу</span>
              </button>
              <button 
                onClick={onNavigateToClients}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="FileText" size={20} className="transition-transform duration-300 group-hover:rotate-12" />
                <span className="text-sm font-medium hidden sm:inline">Отчёты</span>
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

      <DashboardMeetings 
        upcomingMeetings={upcomingMeetings}
        onMeetingClick={handleMeetingClick}
      />


    </div>
  );
};

export default Dashboard;