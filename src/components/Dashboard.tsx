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
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

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

      <Card className="shadow-lg border-2">
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
          onClick={() => setIsStatsExpanded(!isStatsExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Icon name="BarChart3" className="text-primary" size={20} />
              <CardTitle className="text-base md:text-xl font-semibold">Статистика</CardTitle>
            </div>
            <Icon 
              name={isStatsExpanded ? "ChevronUp" : "ChevronDown"} 
              size={20} 
              className="text-muted-foreground transition-transform flex-shrink-0"
            />
          </div>
        </CardHeader>
        
        {isStatsExpanded && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 pt-4">
              {/* Тарифный план */}
              <div className="p-3 md:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <Icon name="CreditCard" className="text-blue-600" size={18} />
                    <h3 className="font-semibold text-xs md:text-sm">Тарифный план</h3>
                  </div>
                </div>
                {isTrialPeriod ? (
                  <div className="space-y-1.5 md:space-y-2">
                    <Badge className="bg-yellow-500 text-white text-[10px] md:text-xs">Пробный период</Badge>
                    <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground">
                      <span>Осталось:</span>
                      <span className="font-bold text-yellow-700">{trialDaysLeft} дней</span>
                    </div>
                    <Progress value={(trialDaysLeft / 30) * 100} className="h-1 md:h-1.5" />
                  </div>
                ) : (
                  <div className="space-y-1.5 md:space-y-2">
                    <Badge className="bg-green-500 text-white text-[10px] md:text-xs">Активная</Badge>
                    <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground">
                      <span>Осталось:</span>
                      <span className="font-bold text-green-700">{subscriptionDaysLeft} дней</span>
                    </div>
                    <Progress value={(subscriptionDaysLeft / 30) * 100} className="h-1 md:h-1.5" />
                  </div>
                )}
              </div>

              {/* Клиенты */}
              <div className="p-3 md:p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <Icon name="Users" className="text-purple-600" size={18} />
                    <h3 className="font-semibold text-xs md:text-sm">Клиенты</h3>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-purple-700">0</div>
                </div>
                <div className="space-y-1 md:space-y-1.5 text-[10px] md:text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>На этой неделе:</span>
                    <span className="font-semibold text-purple-700">0</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>В этом месяце:</span>
                    <span className="font-semibold text-purple-700">0</span>
                  </div>
                </div>
              </div>

              {/* Фотокниги */}
              <div className="p-3 md:p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <Icon name="Book" className="text-orange-600" size={18} />
                    <h3 className="font-semibold text-xs md:text-sm">Фотокниги</h3>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-orange-700">0</div>
                </div>
                <div className="space-y-1 md:space-y-1.5 text-[10px] md:text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>В работе:</span>
                    <span className="font-semibold text-orange-700">0</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Завершено:</span>
                    <span className="font-semibold text-orange-700">0</span>
                  </div>
                </div>
              </div>

              {/* Завершенные проекты */}
              <div className="p-3 md:p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                  <Icon name="CheckCircle2" className="text-green-600" size={16} />
                  <h3 className="font-semibold text-[10px] md:text-xs">Завершённые проекты</h3>
                </div>
                <div className="space-y-1">
                  <Progress value={0} className="h-1 md:h-1.5" />
                  <div className="text-[10px] md:text-xs text-muted-foreground text-right">
                    <span className="font-bold text-green-700">0%</span>
                  </div>
                </div>
              </div>

              {/* Загрузка календаря */}
              <div className="p-3 md:p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                  <Icon name="Calendar" className="text-cyan-600" size={16} />
                  <h3 className="font-semibold text-[10px] md:text-xs">Загрузка календаря</h3>
                </div>
                <div className="space-y-1">
                  <Progress value={0} className="h-1 md:h-1.5" />
                  <div className="text-[10px] md:text-xs text-muted-foreground text-right">
                    <span className="font-bold text-cyan-700">0%</span>
                  </div>
                </div>
              </div>

              {/* Довольные клиенты */}
              <div className="p-3 md:p-4 bg-gradient-to-br from-rose-50 to-pink-50 rounded-lg border border-rose-200">
                <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                  <Icon name="Heart" className="text-rose-600" size={16} />
                  <h3 className="font-semibold text-[10px] md:text-xs">Довольные клиенты</h3>
                </div>
                <div className="space-y-1">
                  <Progress value={0} className="h-1 md:h-1.5" />
                  <div className="text-[10px] md:text-xs text-muted-foreground text-right">
                    <span className="font-bold text-rose-700">0%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="shadow-lg border-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Icon name="Calendar" className="mr-2 text-primary" size={20} md:size={24} />
            <span className="text-base md:text-xl">Ближайшие встречи</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 md:space-y-3 max-h-96 overflow-y-auto pr-1 md:pr-2">
            {upcomingMeetings.length > 0 ? (
              upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  onClick={() => handleMeetingClick(meeting.name)}
                  className="flex items-center justify-between p-2 md:p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer hover:shadow-md"
                >
                  <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
                    <div className="bg-primary/10 p-1.5 md:p-2 rounded-full flex-shrink-0">
                      <Icon name="User" size={16} className="text-primary md:w-[18px] md:h-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm md:text-base truncate">{meeting.name}</p>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">{meeting.type}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-xs md:text-sm font-medium whitespace-nowrap">{meeting.date}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">{meeting.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center px-4">
                <div className="bg-muted rounded-full p-3 md:p-4 mb-3 md:mb-4">
                  <Icon name="CalendarX" size={24} className="text-muted-foreground md:w-8 md:h-8" />
                </div>
                <p className="text-muted-foreground mb-1 md:mb-2 text-sm md:text-base">Нет запланированных встреч</p>
                <p className="text-xs md:text-sm text-muted-foreground">Добавьте новых клиентов и назначьте встречи</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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