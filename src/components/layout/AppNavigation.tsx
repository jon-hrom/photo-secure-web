import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { EnergyTopupDialog } from '@/components/EnergyTopupDialog';
import { CelebrationDialog } from '@/components/CelebrationDialog';
import { toast } from 'sonner';

const ENERGY_URL = 'https://functions.poehali.dev/b78fe245-efbd-4bd0-8db1-2515e8dfafb6';

const PORTFOLIO_ALLOWED_EMAILS = ['jonhrom2012@gmail.com'];
const PHOTOBOOK_ALLOWED_EMAILS = ['jon-hrom2012@gmail.com'];

interface AppNavigationProps {
  currentPage: 'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin' | 'tariffs' | 'help';
  setCurrentPage: (page: 'auth' | 'dashboard' | 'clients' | 'photobook' | 'features' | 'settings' | 'admin' | 'tariffs' | 'help') => void;
  userName: string;
  userEmail: string;
  userAvatar: string;
  isVerified: boolean;
  hasVerifiedPhone?: boolean;
  userId?: string | number | null;
  onLogout: () => void;
  unreadCount?: number;
  onOpenChat?: () => void;
}

const AppNavigation = ({
  currentPage,
  setCurrentPage,
  userName,
  userEmail,
  userAvatar,
  isVerified,
  userId,
  onLogout,
  unreadCount = 0,
  onOpenChat,
}: AppNavigationProps) => {
  const navigate = useNavigate();
  const [planName, setPlanName] = useState<string>('');
  const [energyBalance, setEnergyBalance] = useState<number>(0);
  const [topupOpen, setTopupOpen] = useState(false);
  const [celebration, setCelebration] = useState<null | 'energy' | 'tariff'>(null);
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);

  const isAdmin = (userEmail || '').toLowerCase() === 'jonhrom2012@gmail.com';

  const loadSmsBalance = () => {
    setSmsLoading(true);
    fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-sms-balance' }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.balance === 'number') setSmsBalance(data.balance);
      })
      .catch(() => {})
      .finally(() => setSmsLoading(false));
  };

  const loadEnergy = (cb?: (balance: number) => void) => {
    if (!userId) return;
    fetch(ENERGY_URL, { headers: { 'X-User-Id': String(userId) } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.energy_balance === 'number') {
          setEnergyBalance(data.energy_balance);
          cb?.(data.energy_balance);
        }
      })
      .catch(() => {});
  };

  const loadPlan = () => {
    if (!userId) return;
    fetch('https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985?action=usage', {
      headers: { 'X-User-Id': String(userId) },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.plan_name) setPlanName(data.plan_name); })
      .catch(() => {});
  };

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    fetch('https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985?action=usage', {
      headers: { 'X-User-Id': String(userId) },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.plan_name) setPlanName(data.plan_name);
      })
      .catch(() => {});
    loadEnergy();
    if (isAdmin) loadSmsBalance();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const energy = params.get('energy');
    const payment = params.get('payment');

    if (energy === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => loadEnergy(() => setCelebration('energy')), 800);
    } else if (energy === 'fail') {
      toast.error('Пополнение не завершено. Попробуйте ещё раз.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (payment === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => { loadPlan(); setCelebration('tariff'); }, 800);
    } else if (payment === 'fail') {
      toast.error('Оплата не завершена. Попробуйте ещё раз.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-border/50 dark:border-gray-700/50 sticky top-0 z-50 shadow-lg animate-fade-in">
      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-1 sm:gap-2">
          <div className="flex items-center space-x-1 sm:space-x-3 min-w-0">
            <div className="flex items-center space-x-2 sm:space-x-3 group cursor-pointer min-w-0">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300 shrink-0">
                <Icon name="Camera" className="text-white" size={24} />
              </div>
              <h1 className="hidden sm:block text-2xl font-bold bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent animate-glow">
                Foto-Mix
              </h1>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={currentPage === 'dashboard' ? 'default' : 'ghost'}
                  className={cn(
                    "rounded-full transition-all duration-300 hover:scale-105",
                    currentPage === 'dashboard' && "bg-gradient-to-r from-primary to-secondary shadow-lg"
                  )}
                  data-tour="dashboard"
                >
                  <Icon name="Home" size={18} className="mr-2" />
                  Главная
                  <Icon name="ChevronDown" size={16} className="ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 animate-scale-in backdrop-blur-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-border/50 dark:border-gray-700/50 shadow-xl">
                <DropdownMenuItem onClick={() => setCurrentPage('dashboard')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="LayoutDashboard" size={18} className="mr-2" />
                  Главная
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentPage('clients')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200" data-tour="clients-nav">
                  <Icon name="Users" size={18} className="mr-2" />
                  Клиенты
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/statistics')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="BarChart3" size={18} className="mr-2" />
                  Статистика
                </DropdownMenuItem>
                {PHOTOBOOK_ALLOWED_EMAILS.includes((userEmail || '').toLowerCase()) && (
                  <DropdownMenuItem onClick={() => setCurrentPage('photobook')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200" data-tour="photobook-nav">
                    <Icon name="Book" size={18} className="mr-2" />
                    Фотокниги
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => {
                  navigate('/photo-bank');
                }} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="Images" size={18} className="mr-2" />
                  Мой фото банк
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentPage('tariffs')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="Zap" size={18} className="mr-2" />
                  Тарифы
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                  <Icon name="Settings" size={18} className="mr-2" />
                  Настройки
                </DropdownMenuItem>
                {PORTFOLIO_ALLOWED_EMAILS.includes((userEmail || '').toLowerCase()) && (
                  <DropdownMenuItem onClick={() => navigate('/settings?section=portfolio')} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                    <Icon name="Camera" size={18} className="mr-2" />
                    Портфолио
                  </DropdownMenuItem>
                )}
                {onOpenChat && (
                  <DropdownMenuItem onClick={onOpenChat} className="hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200">
                    <div className="relative mr-2">
                      <Icon name="Mail" size={18} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center leading-none">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    Чат с клиентами
                    {unreadCount > 0 && (
                      <Badge className="ml-auto bg-red-500 text-white text-xs border-0 h-5 min-w-5 flex items-center justify-center px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-3 shrink-0">
            {isAdmin && (
              <Button
                variant="ghost"
                onClick={loadSmsBalance}
                disabled={smsLoading}
                className={`flex items-center gap-1.5 rounded-full px-2 sm:px-3 transition-all duration-300 ${smsBalance !== null && smsBalance < 10 ? 'hover:bg-red-500/10' : 'hover:bg-green-500/10'}`}
                title="Баланс SMS (нажмите для обновления)"
              >
                <Icon
                  name="MessageSquare"
                  size={16}
                  className={`shrink-0 ${smsBalance !== null && smsBalance < 10 ? 'text-red-500' : 'text-green-500'} ${smsLoading ? 'animate-pulse' : ''}`}
                />
                <span className={`text-sm font-semibold ${smsBalance !== null && smsBalance < 10 ? 'text-red-500' : 'text-green-500'}`}>
                  {smsBalance !== null ? `${smsBalance.toFixed(2)} ₽` : '—'}
                </span>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setTopupOpen(true)}
              className={`flex items-center gap-1.5 rounded-full px-2 sm:px-3 transition-all duration-300 ${energyBalance < 10 ? 'hover:bg-red-500/10' : 'hover:bg-yellow-500/10'}`}
              title={energyBalance < 10 ? 'Энергия заканчивается!' : 'Энергия'}
            >
              <Icon
                name="Zap"
                size={16}
                className={`shrink-0 ${energyBalance < 10 ? 'energy-low-anim' : 'text-yellow-500'}`}
              />
              <span className={`text-sm font-semibold ${energyBalance < 10 ? 'energy-low-anim' : 'text-yellow-500'}`}>
                {energyBalance}
              </span>
            </Button>

            {onOpenChat && (
              <Button
                variant="ghost"
                onClick={onOpenChat}
                className="relative rounded-full px-2 sm:px-3 hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-300"
                title="Чат с клиентами"
              >
                <Icon name="Mail" size={20} />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 bg-red-500 text-white h-5 min-w-5 flex items-center justify-center p-0 text-xs border-0 animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={() => setCurrentPage('help')}
              className="hidden md:flex rounded-full hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-300"
              title="Справка"
            >
              <Icon name="HelpCircle" size={20} />
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/settings')}
              className="hidden md:flex rounded-full border-2 border-primary/50 hover:border-primary hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-300 hover:scale-105 hover:shadow-lg"
              data-tour="settings-nav"
            >
              <Icon name="Settings" size={18} className="mr-2" />
              Настройки
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full px-2"
                >
                  {userAvatar ? (
                    <img 
                      src={userAvatar} 
                      alt={userName}
                      className="w-8 h-8 rounded-full border border-gray-200 object-cover"
                    />
                  ) : (
                    <Icon name="User" size={20} />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-border/50 dark:border-gray-700/50">
                {userName && (
                  <div className="px-2 py-2 border-b dark:border-gray-700">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-sm font-medium dark:text-gray-200">{userName}</p>
                      {isVerified && (
                        <Icon name="BadgeCheck" size={16} className="text-blue-500" />
                      )}
                    </div>
                    {userEmail && <p className="text-xs text-gray-500 dark:text-gray-400">{userEmail}</p>}
                  </div>
                )}
                <DropdownMenuItem
                  onClick={() => setCurrentPage('tariffs')}
                  className="cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 dark:text-gray-200"
                >
                  <Icon name="Zap" size={18} className="mr-2 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-none">Ваш тариф</span>
                    <span className="text-sm font-semibold leading-tight">{planName || 'Старт'}</span>
                  </div>
                  <Icon name="ChevronRight" size={16} className="ml-auto text-gray-400" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); setTopupOpen(true); }}
                  className="cursor-pointer hover:bg-gradient-to-r hover:from-yellow-500/10 hover:to-orange-500/10 transition-all duration-200 dark:text-gray-200"
                >
                  <Icon name="Zap" size={18} className="mr-2 text-yellow-500" />
                  <div className="flex flex-col">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-none">Баланс энергии</span>
                    <span className="text-sm font-semibold leading-tight">{energyBalance} энергии</span>
                  </div>
                  <Icon name="Plus" size={16} className="ml-auto text-gray-400" />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="md:hidden dark:text-gray-200">
                  <Icon name="Settings" size={18} className="mr-2" />
                  Настройки
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} className="dark:text-gray-200">
                  <Icon name="LogOut" size={18} className="mr-2" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {userId && (
        <EnergyTopupDialog
          open={topupOpen}
          onClose={() => setTopupOpen(false)}
          userId={userId}
          currentBalance={energyBalance}
          onSuccess={() => loadEnergy(() => setCelebration('energy'))}
        />
      )}

      <CelebrationDialog
        open={celebration !== null}
        onClose={() => setCelebration(null)}
        kind={celebration === 'tariff' ? 'tariff' : 'energy'}
        energyBalance={energyBalance}
        planName={planName}
      />
    </nav>
  );
};

export default AppNavigation;