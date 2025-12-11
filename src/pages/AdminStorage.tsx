import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { PlansTab } from '@/components/admin/PlansTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { StatsTab } from '@/components/admin/StatsTab';
import { FinancialTab } from '@/components/admin/FinancialTab';
import { AdminStorageAuth } from '@/components/admin/AdminStorageAuth';
import { AdminStorageStats } from '@/components/admin/AdminStorageStats';
import MobileNavigation from '@/components/layout/MobileNavigation';
import {
  useAdminStorageAPI,
  type Plan,
  type User,
  type UsageStat,
  type RevenueStat,
  type FinancialStat,
  type FinancialSummary,
} from '@/components/admin/AdminStorageAPI';

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

  const api = useAdminStorageAPI(adminKey);

  const refetchPlans = () => api.fetchPlans(setPlans);
  const refetchUsers = () => api.fetchUsers(setUsers);
  const refetchStats = () => api.fetchStats(setUsageStats, setRevenueStats, setLoading);

  useEffect(() => {
    if (adminKey) {
      api.fetchFinancialStats(financialPeriod, setFinancialStats, setFinancialSummary, setLoading);
    }
  }, [financialPeriod, adminKey]);

  useEffect(() => {
    if (adminKey) {
      console.log('[ADMIN_STORAGE] AdminKey set, fetching data...');
      refetchPlans();
      refetchUsers();
      refetchStats();
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            aria-label="Назад"
          >
            <Icon name="ArrowLeft" className="h-5 w-5" />
          </button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Управление хранилищем</h1>
        </div>

        <AdminStorageStats
          totalUsers={totalUsers}
          totalRevenue={totalRevenue}
          totalStorageUsed={totalStorageUsed}
        />

        <Tabs defaultValue="plans" className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
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

          <TabsContent value="stats" className="space-y-4">
            <StatsTab
              usageStats={usageStats}
              revenueStats={revenueStats}
              totalRevenue={totalRevenue}
              loading={loading}
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
        </Tabs>
      </div>
      
      <MobileNavigation />
    </div>
  );
};

export default AdminStorage;