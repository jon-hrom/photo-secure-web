import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { PlansTab } from '@/components/admin/PlansTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { StatsTab } from '@/components/admin/StatsTab';
import { FinancialTab } from '@/components/admin/FinancialTab';
import { PromoCodesTab } from '@/components/admin/PromoCodesTab';
import { AdminStorageAuth } from '@/components/admin/AdminStorageAuth';
import { AdminStorageStats } from '@/components/admin/AdminStorageStats';
import { StorageBillingTab } from '@/components/admin/StorageBillingTab';
import { StorageTrashTab } from '@/components/admin/StorageTrashTab';
import MobileNavigation from '@/components/layout/MobileNavigation';
import {
  useAdminStorageAPI,
  type Plan,
  type User,
  type UsageStat,
  type RevenueStat,
  type FinancialStat,
  type FinancialSummary,
  type PromoCode,
} from '@/components/admin/AdminStorageAPI';

interface CachedData {
  plans: Plan[];
  users: User[];
  usageStats: UsageStat[];
  revenueStats: RevenueStat[];
  financialStats: FinancialStat[];
  financialSummary: FinancialSummary | null;
  timestamp: number;
}

const CACHE_KEY = 'admin_storage_cache';
const CACHE_DURATION = 5 * 60 * 1000;

const AdminStorage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStat[]>([]);
  const [financialStats, setFinancialStats] = useState<FinancialStat[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [financialPeriod, setFinancialPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [loading, setLoading] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [cloudStorageStats, setCloudStorageStats] = useState<any[]>([]);
  const [cloudStorageSummary, setCloudStorageSummary] = useState<any>({});

  const api = useAdminStorageAPI(adminKey);

  const saveToCache = (data: Omit<CachedData, 'timestamp'>) => {
    const cached: CachedData = { ...data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    setLastUpdate(Date.now());
    console.log('[CACHE] Data saved to cache');
  };

  const loadFromCache = (): CachedData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const data: CachedData = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      
      if (age > CACHE_DURATION) {
        console.log('[CACHE] Cache expired, age:', Math.floor(age / 1000), 'seconds');
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      console.log('[CACHE] Cache loaded, age:', Math.floor(age / 1000), 'seconds');
      return data;
    } catch (error) {
      console.error('[CACHE] Error loading cache:', error);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  };

  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    setLastUpdate(null);
    console.log('[CACHE] Cache cleared');
  };

  const fetchAllData = async () => {
    console.log('[FETCH] Starting fresh data fetch...');
    setLoading(true);
    
    const tempPlans: Plan[] = [];
    const tempUsers: User[] = [];
    const tempUsageStats: UsageStat[] = [];
    const tempRevenueStats: RevenueStat[] = [];
    
    await Promise.all([
      api.fetchPlans((p) => { tempPlans.push(...p); setPlans(p); }),
      api.fetchUsers((u) => { tempUsers.push(...u); setUsers(u); }),
      api.fetchStats(
        (us) => { tempUsageStats.push(...us); setUsageStats(us); },
        (rs) => { tempRevenueStats.push(...rs); setRevenueStats(rs); },
        setLoading,
        setCloudStorageStats,
        setCloudStorageSummary
      ),
    ]);
    
    saveToCache({
      plans: tempPlans,
      users: tempUsers,
      usageStats: tempUsageStats,
      revenueStats: tempRevenueStats,
      financialStats,
      financialSummary,
    });
    
    setLoading(false);
    console.log('[FETCH] Fresh data fetched and cached');
  };

  const refetchPlans = () => api.fetchPlans(setPlans);
  const refetchUsers = () => api.fetchUsers(setUsers);
  const refetchStats = () => api.fetchStats(setUsageStats, setRevenueStats, setLoading, setCloudStorageStats, setCloudStorageSummary);
  const refetchPromoCodes = () => api.fetchPromoCodes(setPromoCodes);

  useEffect(() => {
    if (adminKey) {
      api.fetchFinancialStats(financialPeriod, setFinancialStats, setFinancialSummary, setLoading);
    }
  }, [financialPeriod, adminKey]);

  useEffect(() => {
    if (adminKey) {
      console.log('[ADMIN_STORAGE] AdminKey set, checking cache...');
      
      const cached = loadFromCache();
      if (cached) {
        console.log('[ADMIN_STORAGE] Loading from cache');
        setPlans(cached.plans);
        setUsers(cached.users);
        setUsageStats(cached.usageStats);
        setRevenueStats(cached.revenueStats);
        setFinancialStats(cached.financialStats);
        setFinancialSummary(cached.financialSummary);
        setLastUpdate(cached.timestamp);
      } else {
        console.log('[ADMIN_STORAGE] No valid cache, fetching fresh data...');
        fetchAllData();
      }
      // Загружаем промокоды отдельно (они не кэшируются)
      refetchPromoCodes();
    }
  }, [adminKey]);

  const totalRevenue = revenueStats.reduce((sum, stat) => sum + stat.total_revenue, 0);
  const totalUsers = users.length;
  const totalStorageUsed = users.reduce((sum, user) => sum + user.used_gb, 0);

  if (!adminKey) {
    return (
      <>
        <AdminStorageAuth onAuthSuccess={setAdminKey} />
        <div className="min-h-screen bg-background p-6 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Проверка прав доступа...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              aria-label="Назад"
            >
              <Icon name="ArrowLeft" className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Управление хранилищем</h1>
              {lastUpdate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Обновлено {Math.floor((Date.now() - lastUpdate) / 1000 / 60)} мин назад
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              clearCache();
              fetchAllData();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
          >
            <Icon name="RefreshCw" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Обновить</span>
          </button>
        </div>

        <AdminStorageStats
          totalUsers={totalUsers}
          totalRevenue={totalRevenue}
          totalStorageUsed={totalStorageUsed}
        />

        <Tabs defaultValue="plans" className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-7 w-full">
            <TabsTrigger value="plans" className="text-xs sm:text-sm">
              <Icon name="Package" className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Тарифы</span>
              <span className="sm:hidden">План</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs sm:text-sm">
              <Icon name="Users" className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Пользователи</span>
              <span className="sm:hidden">Люди</span>
            </TabsTrigger>
            <TabsTrigger value="promo" className="text-xs sm:text-sm">
              <Icon name="Tag" className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Промокоды</span>
              <span className="sm:hidden">Промо</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs sm:text-sm">
              <Icon name="BarChart" className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Статистика</span>
              <span className="sm:hidden">Стат</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="text-xs sm:text-sm">
              <Icon name="DollarSign" className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Финансы</span>
              <span className="sm:hidden">₽</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs sm:text-sm">
              <Icon name="Receipt" className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Биллинг</span>
              <span className="sm:hidden">Счёт</span>
            </TabsTrigger>
            <TabsTrigger value="trash" className="text-xs sm:text-sm">
              <Icon name="Trash2" className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Корзина</span>
              <span className="sm:hidden">🗑️</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4">
            <PlansTab
              plans={plans}
              onSavePlan={(plan) => api.handleSavePlan(plan, refetchPlans)}
              onDeletePlan={(planId) => api.handleDeletePlan(planId, refetchPlans)}
              onSetDefaultPlan={(planId) => api.handleSetDefaultPlan(planId, refetchUsers)}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <UsersTab
              users={users}
              plans={plans}
              onUpdateUser={(user) => api.handleUpdateUser(user, refetchUsers)}
            />
          </TabsContent>

          <TabsContent value="promo" className="space-y-4">
            <PromoCodesTab
              promoCodes={promoCodes}
              onCreatePromoCode={(promo) => api.handleCreatePromoCode(promo, refetchPromoCodes)}
              onTogglePromoCode={(id, isActive) => api.handleTogglePromoCode(id, isActive, refetchPromoCodes)}
              onDeletePromoCode={(id) => api.handleDeletePromoCode(id, refetchPromoCodes)}
            />
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <StatsTab
              usageStats={usageStats}
              revenueStats={revenueStats}
              totalRevenue={totalRevenue}
              loading={loading}
              cloudStorageStats={cloudStorageStats}
              cloudStorageSummary={cloudStorageSummary}
            />
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <FinancialTab
              financialStats={financialStats}
              financialSummary={financialSummary}
              financialPeriod={financialPeriod}
              onPeriodChange={setFinancialPeriod}
            />
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <StorageBillingTab adminKey={adminKey} users={users} />
          </TabsContent>

          <TabsContent value="trash" className="space-y-4">
            <StorageTrashTab adminKey={adminKey} />
          </TabsContent>
        </Tabs>
      </div>
      
      <MobileNavigation />
    </div>
  );
};

export default AdminStorage;