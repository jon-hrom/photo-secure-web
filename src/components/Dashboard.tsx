import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import StorageWarning from '@/components/StorageWarning';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
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
  
  const isVkAdmin = vkUser && vkUser.name && (
    vkUser.name.includes('Пономарев Евгений') || 
    vkUser.name.includes('Евгений Пономарёв') ||
    vkUser.name.includes('Евгений')
  );
  const finalIsAdmin = isAdmin || isVkAdmin;

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
      {vkUser && (
        <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-xl">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              {vkUser.avatar && (
                <div className="relative flex-shrink-0">
                  <img 
                    src={vkUser.avatar} 
                    alt={vkUser.name}
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-white shadow-lg object-cover"
                  />
                  {vkUser.is_verified && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
                      <Icon name="BadgeCheck" size={14} className="text-blue-500" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                  <h3 className="text-lg sm:text-xl font-bold truncate">{vkUser.name || 'Пользователь VK'}</h3>
                  {vkUser.is_verified && (
                    <Icon name="BadgeCheck" size={18} className="text-white hidden sm:block" />
                  )}
                  {(vkUser.name && vkUser.name.includes('Пономарев Евгений')) && (
                    <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold border border-white/30 w-fit">
                      Администратор
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm opacity-90 truncate">{vkUser.email || 'Вход через VK ID'}</p>
                {vkUser.phone && (
                  <p className="text-xs opacity-75 mt-1 truncate">{vkUser.phone}</p>
                )}
              </div>
              <div className="flex flex-row sm:flex-col items-center gap-2 w-full sm:w-auto sm:items-end">
                {finalIsAdmin && onOpenAdminPanel && (
                  <button
                    onClick={onOpenAdminPanel}
                    className="px-2.5 py-1.5 sm:px-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors border border-white/30 flex items-center gap-1.5 flex-1 sm:flex-initial justify-center"
                    title="Админ-панель"
                  >
                    <Icon name="ShieldCheck" size={14} className="text-white" />
                    <span className="text-xs font-semibold">Админка</span>
                  </button>
                )}
                {onLogout && (
                  <button
                    onClick={() => setShowLogoutDialog(true)}
                    className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"
                    title="Выйти"
                  >
                    <Icon name="LogOut" size={18} className="text-white" />
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
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

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="hover-scale transition-all shadow-lg border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Тарифный план</CardTitle>
              <Icon name="CreditCard" className="text-primary" size={24} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTrialPeriod ? (
              <>
                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  Пробный период
                </Badge>
                <div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Осталось дней:</span>
                    <span className="font-bold">{trialDaysLeft}</span>
                  </div>
                  <Progress value={(trialDaysLeft / 30) * 100} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Баланс: <span className="font-bold">{balance}₽</span> в месяц
                </p>
              </>
            ) : (
              <>
                <Badge className="bg-green-500 hover:bg-green-600 text-white">
                  Активная подписка
                </Badge>
                <div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Осталось дней:</span>
                    <span className="font-bold">{subscriptionDaysLeft}</span>
                  </div>
                  <Progress value={(subscriptionDaysLeft / 30) * 100} className="h-2" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover-scale transition-all shadow-lg border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Клиенты</CardTitle>
              <Icon name="Users" className="text-secondary" size={24} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">12</div>
            <p className="text-sm text-muted-foreground">Всего в базе</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>На этой неделе:</span>
                <span className="font-semibold">3</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>В этом месяце:</span>
                <span className="font-semibold">7</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-scale transition-all shadow-lg border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Фотокниги</CardTitle>
              <Icon name="Book" className="text-accent" size={24} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">5</div>
            <p className="text-sm text-muted-foreground">Проектов создано</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>В работе:</span>
                <span className="font-semibold">2</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Завершено:</span>
                <span className="font-semibold">3</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Icon name="Calendar" className="mr-2 text-primary" size={24} />
              Ближайшие встречи
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  onClick={() => handleMeetingClick(meeting.name)}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer hover:shadow-md"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Icon name="User" size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{meeting.name}</p>
                      <p className="text-sm text-muted-foreground">{meeting.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{meeting.date}</p>
                    <p className="text-sm text-muted-foreground">{meeting.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Icon name="TrendingUp" className="mr-2 text-secondary" size={24} />
              Статистика
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Завершённые проекты</span>
                <span className="font-bold">85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Загрузка календаря</span>
                <span className="font-bold">62%</span>
              </div>
              <Progress value={62} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Довольные клиенты</span>
                <span className="font-bold">98%</span>
              </div>
              <Progress value={98} className="h-2" />
            </div>
            {userRole === 'admin' && (
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Доход за месяц:</span>
                  <span className="text-2xl font-bold text-green-600">125,000₽</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-2 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Icon name="Lightbulb" className="mr-2 text-accent" size={24} />
            Быстрые действия
          </CardTitle>
        </CardHeader>
        <CardContent>
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

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon name="LogOut" className="text-orange-500" size={24} />
              Выход из аккаунта
            </AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите выйти? Вам потребуется снова войти в систему для доступа к своему аккаунту.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLogoutDialog(false);
                onLogout?.();
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Icon name="LogOut" size={16} className="mr-2" />
              Выйти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;