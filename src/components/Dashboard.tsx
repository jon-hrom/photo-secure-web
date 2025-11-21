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
}

const Dashboard = ({ userRole, userId: propUserId, onOpenClientBooking, onLogout, onOpenAdminPanel, isAdmin }: DashboardProps) => {
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
  const [storageUsage, setStorageUsage] = useState({ usedGb: 0, limitGb: 5, percent: 0 });

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
        setStorageUsage({ usedGb: 0, limitGb: 5, percent: 0 });
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
          setStorageUsage({ usedGb: 0, limitGb: 5, percent: 0 });
          return;
        }
        
        const data = await res.json();
        console.log('[STORAGE] Received data:', JSON.stringify(data));
        setStorageUsage({
          usedGb: data.usedGb || 0,
          limitGb: data.limitGb || 5,
          percent: data.percent || 0
        });
      } catch (error) {
        console.error('[STORAGE] Failed to fetch storage usage:', error);
        setStorageUsage({ usedGb: 0, limitGb: 5, percent: 0 });
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
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="HardDrive" size={20} className="text-primary" />
                <h3 className="font-semibold">Фото банк</h3>
              </div>
              <Badge variant={storageUsage.percent >= 90 ? 'destructive' : storageUsage.percent >= 70 ? 'default' : 'secondary'}>
                {(storageUsage.percent || 0).toFixed(1)}%
              </Badge>
            </div>
            <Progress 
              value={storageUsage.percent || 0} 
              className="h-3 transition-all duration-500 ease-out"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
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
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold mb-2">{formatTime(currentTime)}</h2>
              <p className="text-lg opacity-90 capitalize text-center font-light">{formatDate(currentTime)}</p>
            </div>
            <Icon name="Clock" size={64} className="opacity-30" />
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

      <Card className="shadow-lg border-2 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="pt-6">
          <div className="flex items-center mb-4">
            <Icon name="Lightbulb" className="mr-2 text-accent" size={24} />
            <h3 className="text-xl font-semibold">Быстрые действия</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover-scale">
              <div className="bg-primary/10 p-3 rounded-full mb-2">
                <Icon name="UserPlus" className="text-primary" size={24} />
              </div>
              <span className="text-sm font-medium text-center">Добавить клиента</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover-scale">
              <div className="bg-secondary/10 p-3 rounded-full mb-2">
                <Icon name="Calendar" className="text-secondary" size={24} />
              </div>
              <span className="text-sm font-medium text-center">Новая запись</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover-scale">
              <div className="bg-accent/10 p-3 rounded-full mb-2">
                <Icon name="BookOpen" className="text-accent" size={24} />
              </div>
              <span className="text-sm font-medium text-center">Создать фотокнигу</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover-scale">
              <div className="bg-green-100 p-3 rounded-full mb-2">
                <Icon name="FileText" className="text-green-600" size={24} />
              </div>
              <span className="text-sm font-medium text-center">Отчёты</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;