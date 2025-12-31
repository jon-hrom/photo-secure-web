import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import StorageWarning from '@/components/StorageWarning';
import LocationWarningBanner from '@/components/LocationWarningBanner';
import DashboardUserCard from '@/components/dashboard/DashboardUserCard';
import DashboardCalendar from '@/components/dashboard/DashboardCalendar';
import DashboardBookingDetailsDialog from '@/components/dashboard/DashboardBookingDetailsDialog';
import DashboardProjectDetailsDialog from '@/components/dashboard/DashboardProjectDetailsDialog';
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
  onNavigateToPhotoBank?: () => void;
  onOpenAddClient?: () => void;
  onNavigateToSettings?: () => void;
}

const Dashboard = ({ userRole, userId: propUserId, clients: propClients = [], onOpenClientBooking, onMeetingClick, onLogout, onOpenAdminPanel, isAdmin, onOpenTariffs, onNavigateToClients, onNavigateToPhotobook, onNavigateToPhotoBank, onOpenAddClient, onNavigateToSettings }: DashboardProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [trialDaysLeft] = useState(14);
  const [subscriptionDaysLeft] = useState(0);
  const [balance] = useState(0);

  const [storageUsage, setStorageUsage] = useState({ usedGb: 0, limitGb: 5, percent: 0, plan_name: 'Старт', plan_id: 1 });
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isProjectDetailsOpen, setIsProjectDetailsOpen] = useState(false);
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
    
    const projectBookings = propClients
      .flatMap((client: Client) => 
        (client.projects || []).map(project => {
          if (!project.startDate || !project.shooting_time) return null;
          
          const shootingDate = new Date(project.startDate);
          shootingDate.setHours(0, 0, 0, 0);
          
          return {
            id: project.id,
            date: shootingDate,
            time: project.shooting_time,
            description: project.name,
            client,
            project
          };
        })
      )
      .filter((b: any) => {
        if (!b) return false;
        return b.date >= today;
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);

    setUpcomingBookings(projectBookings);
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
      <LocationWarningBanner 
        userId={propUserId} 
        onNavigateToSettings={onNavigateToSettings}
      />
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-primary to-secondary text-white border-0 shadow-xl w-full lg:w-1/2">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 sm:gap-3 md:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              {(() => {
                const displayUser = vkUser || emailUser;
                const displayName = displayUser?.name || displayUser?.userEmail || displayUser?.email || 'Пользователь';
                const displayEmail = displayUser?.email || displayUser?.userEmail || 'Вход через почту';
                const displayAvatar = displayUser?.avatar || null;
                const displayVerified = displayUser?.is_verified || displayUser?.verified || false;
                
                return (
                  <div className="flex items-start gap-2 sm:gap-3">
                    {displayAvatar && (
                      <div className="relative flex-shrink-0">
                        <img 
                          src={displayAvatar} 
                          alt={displayName}
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 sm:border-3 border-white shadow-lg object-cover"
                        />
                        {displayVerified && (
                          <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 bg-white rounded-full p-0.5 sm:p-1">
                            <Icon name="BadgeCheck" size={10} className="text-blue-500 sm:w-3 sm:h-3" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-start gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
                            <h3 className="text-sm sm:text-base font-bold truncate">{displayName}</h3>
                            {displayVerified && (
                              <Icon name="BadgeCheck" size={12} className="text-white sm:w-[14px] sm:h-[14px] flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs opacity-75 truncate">{displayEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Icon name="Clock" size={24} className="opacity-30 sm:w-8 sm:h-8 flex-shrink-0" />
                        <div className="min-w-0">
                          <h2 className="text-lg sm:text-xl md:text-2xl font-bold leading-tight">{formatTime(currentTime)}</h2>
                          <p className="text-[10px] sm:text-xs opacity-75 capitalize">{formatDate(currentTime)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-wrap w-full lg:w-auto justify-end">
              {finalIsAdmin && onOpenAdminPanel && (
                <button
                  onClick={onOpenAdminPanel}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
                  title="Админ-панель"
                >
                  <Icon name="ShieldCheck" size={14} className="text-white sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-xs font-medium">Админка</span>
                </button>
              )}
              <button 
                onClick={onOpenAddClient}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="UserPlus" size={14} className="transition-transform duration-300 group-hover:rotate-12 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Добавить клиента</span>
              </button>
              <a
                href="/mobile-upload"
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95 border border-green-400/30"
              >
                <Icon name="Upload" size={14} className="transition-transform duration-300 group-hover:rotate-12 sm:w-4 sm:h-4 text-green-100" />
                <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Загрузить фото</span>
              </a>
              <button 
                onClick={onNavigateToPhotobook}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="BookOpen" size={14} className="transition-transform duration-300 group-hover:rotate-12 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Создать фотокнигу</span>
              </button>
              <button 
                onClick={onNavigateToClients}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
              >
                <Icon name="FileText" size={14} className="transition-transform duration-300 group-hover:rotate-12 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Отчёты</span>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/20 hover:bg-white/30 hover:scale-105 hover:shadow-lg backdrop-blur-sm rounded-lg transition-all duration-300 active:scale-95"
                  title="Выйти"
                >
                  <Icon name="LogOut" size={14} className="text-white sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Выйти</span>
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
        
        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 border-0 shadow-xl cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group w-full lg:w-1/2"
          onClick={() => onNavigateToPhotoBank?.()}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="pt-3 sm:pt-4 md:pt-6 relative z-10">
            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-2 md:gap-3">
                  <div className="p-1.5 sm:p-1.5 md:p-2 bg-gradient-to-br from-primary to-secondary rounded-lg sm:rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    <Icon name="HardDrive" size={16} className="text-white sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base md:text-lg text-gray-900 dark:text-white">Фото банк</h3>
                    <Badge variant="outline" className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm dark:text-gray-200 dark:border-gray-600">{storageUsage.plan_name}</Badge>
                  </div>
                </div>
                <Badge 
                  variant={storageUsage.percent >= 90 ? 'destructive' : storageUsage.percent >= 70 ? 'default' : 'secondary'}
                  className="text-[10px] sm:text-xs md:text-sm font-bold px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-0.5 md:py-1 shadow-md flex-shrink-0"
                >
                  {(storageUsage.percent || 0).toFixed(1)}%
                </Badge>
              </div>
              <Progress 
                value={storageUsage.percent || 0} 
                className="h-2 sm:h-3 md:h-4 transition-all duration-500 ease-out shadow-inner"
              />
              <div className="flex justify-between text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground dark:text-gray-300">
                <span>{(storageUsage.usedGb || 0).toFixed(2)} ГБ</span>
                <span>{(storageUsage.limitGb || 5).toFixed(0)} ГБ</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <StorageWarning />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <DashboardCalendar 
          clients={propClients}
          onBookingClick={(client, booking) => {
            setSelectedClient(client);
            setSelectedBooking(booking);
            setIsBookingDetailsOpen(true);
          }}
          onProjectClick={(client, project) => {
            setSelectedClient(client);
            setSelectedProject(project);
            setIsProjectDetailsOpen(true);
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

      {selectedBooking?.project ? (
        <DashboardProjectDetailsDialog
          open={isBookingDetailsOpen}
          onOpenChange={setIsBookingDetailsOpen}
          client={selectedClient}
          project={selectedBooking.project}
        />
      ) : (
        <DashboardBookingDetailsDialog
          open={isBookingDetailsOpen}
          onOpenChange={setIsBookingDetailsOpen}
          client={selectedClient}
          booking={selectedBooking}
        />
      )}

      <DashboardProjectDetailsDialog
        open={isProjectDetailsOpen}
        onOpenChange={setIsProjectDetailsOpen}
        client={selectedClient}
        project={selectedProject}
      />

    </div>
  );
};

export default Dashboard;