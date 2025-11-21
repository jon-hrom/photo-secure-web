import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { PlansTab } from '@/components/admin/PlansTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { StatsTab } from '@/components/admin/StatsTab';
import { FinancialTab } from '@/components/admin/FinancialTab';
import { isAdminUser } from '@/utils/adminCheck';

const ADMIN_API = 'https://functions.poehali.dev/81fe316e-43c6-4e9f-93a2-63032b5c552c';

interface Plan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  price_rub: number;
  is_active: boolean;
  visible_to_users: boolean;
  created_at: string;
}

interface User {
  user_id: number;
  username: string;
  plan_id: number;
  plan_name: string;
  custom_quota_gb: number | null;
  used_gb: number;
  created_at: string;
}

interface UsageStat {
  date: string;
  uploads: number;
  total_size_gb: number;
  unique_users: number;
}

interface RevenueStat {
  plan_name: string;
  users_count: number;
  total_revenue: number;
}

interface FinancialStat {
  date: string;
  storage_gb: number;
  active_users: number;
  total_revenue: number;
  estimated_cost: number;
}

interface FinancialSummary {
  total_revenue: number;
  total_cost: number;
  profit: number;
  margin_percent: number;
}

const AdminStorage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStat[]>([]);
  const [financialStats, setFinancialStats] = useState<FinancialStat[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [financialPeriod, setFinancialPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [loading, setLoading] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    console.log('[ADMIN_STORAGE] Component mounted, checking admin rights...');
    
    // Проверяем является ли пользователь администратором
    const authSession = localStorage.getItem('authSession');
    const vkUser = localStorage.getItem('vk_user');
    
    console.log('[ADMIN_STORAGE] authSession:', authSession ? 'exists' : 'missing');
    console.log('[ADMIN_STORAGE] vkUser:', vkUser ? 'exists' : 'missing');
    
    let userEmail = null;
    let vkUserData = null;
    
    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        userEmail = session.userEmail;
        console.log('[ADMIN_STORAGE] Extracted userEmail:', userEmail);
      } catch (e) {
        console.error('[ADMIN_STORAGE] Failed to parse authSession:', e);
      }
    }
    
    if (vkUser) {
      try {
        vkUserData = JSON.parse(vkUser);
        console.log('[ADMIN_STORAGE] Extracted vkUserData:', vkUserData);
      } catch (e) {
        console.error('[ADMIN_STORAGE] Failed to parse vkUser:', e);
      }
    }
    
    const isAdmin = isAdminUser(userEmail, vkUserData);
    console.log('[ADMIN_STORAGE] isAdminUser result:', isAdmin);
    
    if (!isAdmin) {
      console.error('[ADMIN_STORAGE] Access denied - not an admin');
      toast({ 
        title: 'Ошибка доступа', 
        description: 'У вас нет прав администратора для доступа к этой странице.', 
        variant: 'destructive' 
      });
      return;
    }
    
    // Используем фиксированный ключ для админов
    const key = 'admin123';
    setAdminKey(key);
    console.log('[ADMIN_STORAGE] Admin access granted, adminKey set');
  }, []);

  const fetchPlans = async () => {
    if (!adminKey) {
      console.log('[FETCH_PLANS] Waiting for adminKey...');
      return;
    }
    try {
      console.log('[FETCH_PLANS] Starting request to:', `${ADMIN_API}?action=list-plans`);
      console.log('[FETCH_PLANS] Using adminKey:', adminKey);
      
      const res = await fetch(`${ADMIN_API}?action=list-plans`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      
      console.log('[FETCH_PLANS] Response status:', res.status);
      console.log('[FETCH_PLANS] Response ok:', res.ok);
      
      const data = await res.json();
      console.log('[FETCH_PLANS] Response data:', data);
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      
      setPlans(data.plans || []);
      console.log('[FETCH_PLANS] Plans loaded successfully:', data.plans?.length || 0);
    } catch (error: any) {
      console.error('[FETCH_PLANS] Error:', error);
      toast({ 
        title: 'Ошибка', 
        description: `Не удалось загрузить тарифы: ${error.message}`, 
        variant: 'destructive' 
      });
    }
  };

  const fetchUsers = async () => {
    if (!adminKey) {
      console.log('[FETCH_USERS] Waiting for adminKey...');
      return;
    }
    try {
      console.log('[FETCH_USERS] Starting request...');
      const res = await fetch(`${ADMIN_API}?action=list-users&limit=100&offset=0`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      console.log('[FETCH_USERS] Response status:', res.status);
      const data = await res.json();
      console.log('[FETCH_USERS] Response data:', data);
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      
      setUsers(data.users || []);
      console.log('[FETCH_USERS] Users loaded:', data.users?.length || 0);
    } catch (error: any) {
      console.error('[FETCH_USERS] Error:', error);
      toast({ 
        title: 'Ошибка', 
        description: `Не удалось загрузить пользователей: ${error.message}`, 
        variant: 'destructive' 
      });
    }
  };

  const fetchStats = async () => {
    if (!adminKey) {
      console.log('[FETCH_STATS] Waiting for adminKey...');
      return;
    }
    setLoading(true);
    try {
      console.log('[FETCH_STATS] Starting requests...');
      const [usageRes, revenueRes] = await Promise.all([
        fetch(`${ADMIN_API}?action=usage-stats&days=30`, {
          headers: { 'X-Admin-Key': adminKey }
        }),
        fetch(`${ADMIN_API}?action=revenue-stats`, {
          headers: { 'X-Admin-Key': adminKey }
        })
      ]);

      console.log('[FETCH_STATS] Usage response status:', usageRes.status);
      console.log('[FETCH_STATS] Revenue response status:', revenueRes.status);

      const usageData = await usageRes.json();
      const revenueData = await revenueRes.json();

      console.log('[FETCH_STATS] Usage data:', usageData);
      console.log('[FETCH_STATS] Revenue data:', revenueData);

      setUsageStats(usageData.stats || []);
      setRevenueStats(revenueData.revenue || []);
    } catch (error) {
      console.error('[FETCH_STATS] Error:', error);
      toast({ title: 'Ошибка', description: 'Не удалось загрузить статистику', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialStats = async (period: string) => {
    setLoading(true);
    try {
      console.log('[FETCH_FINANCIAL] Starting request for period:', period);
      const res = await fetch(`${ADMIN_API}?action=financial-stats&period=${period}`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      console.log('[FETCH_FINANCIAL] Response status:', res.status);
      const data = await res.json();
      console.log('[FETCH_FINANCIAL] Response data:', data);
      setFinancialStats(data.stats || []);
      setFinancialSummary(data.summary || null);
      console.log('[FETCH_FINANCIAL] Financial stats loaded:', data.stats?.length || 0);
    } catch (error) {
      console.error('[FETCH_FINANCIAL] Error:', error);
      toast({ title: 'Ошибка', description: 'Не удалось загрузить финансовую статистику', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) {
      fetchFinancialStats(financialPeriod);
    }
  }, [financialPeriod, adminKey]);

  useEffect(() => {
    if (adminKey) {
      console.log('[ADMIN_STORAGE] AdminKey set, fetching data...');
      fetchPlans();
      fetchUsers();
      fetchStats();
    }
  }, [adminKey]);

  const handleSavePlan = async (editingPlan: Partial<Plan>) => {
    if (!editingPlan) return;

    try {
      const action = editingPlan.plan_id ? 'update-plan' : 'create-plan';
      console.log('[SAVE_PLAN] Sending request:', { action, plan: editingPlan });
      
      const res = await fetch(`${ADMIN_API}?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify(editingPlan)
      });

      console.log('[SAVE_PLAN] Response status:', res.status);
      const data = await res.json();
      console.log('[SAVE_PLAN] Response data:', data);
      
      if (!res.ok) {
        throw new Error(data.error || `Ошибка ${res.status}: ${res.statusText}`);
      }

      toast({ title: 'Успешно', description: 'Тариф сохранен' });
      fetchPlans();
    } catch (error: any) {
      console.error('[SAVE_PLAN] Error:', error);
      toast({ 
        title: 'Ошибка', 
        description: error.message || 'Не удалось сохранить тариф', 
        variant: 'destructive' 
      });
    }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!confirm('Удалить тариф?')) return;

    try {
      await fetch(`${ADMIN_API}?action=delete-plan`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ plan_id: planId })
      });

      toast({ title: 'Успешно', description: 'Тариф удален' });
      fetchPlans();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось удалить тариф', variant: 'destructive' });
    }
  };

  const handleUpdateUser = async (editingUser: Partial<User> & { custom_price?: number; started_at?: string; ended_at?: string }) => {
    if (!editingUser?.user_id) return;

    try {
      console.log('[UPDATE_USER] Sending request:', editingUser);
      
      const res = await fetch(`${ADMIN_API}?action=update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({
          user_id: editingUser.user_id,
          plan_id: editingUser.plan_id,
          custom_quota_gb: editingUser.custom_quota_gb,
          custom_price: editingUser.custom_price,
          started_at: editingUser.started_at,
          ended_at: editingUser.ended_at || null
        })
      });

      const data = await res.json();
      console.log('[UPDATE_USER] Response:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка сервера');
      }

      toast({ title: 'Успешно', description: 'Тариф назначен пользователю' });
      fetchUsers();
    } catch (error: any) {
      console.error('[UPDATE_USER] Error:', error);
      toast({ 
        title: 'Ошибка', 
        description: error.message || 'Не удалось обновить пользователя', 
        variant: 'destructive' 
      });
    }
  };

  const handleSetDefaultPlan = async (planId: number) => {
    if (!confirm('Назначить этот тариф всем пользователям без тарифа?')) return;

    try {
      const res = await fetch(`${ADMIN_API}?action=set-default-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ plan_id: planId })
      });

      const data = await res.json();
      toast({ 
        title: 'Успешно', 
        description: `Тариф назначен ${data.affected} пользователям` 
      });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось назначить тариф', variant: 'destructive' });
    }
  };

  const totalRevenue = revenueStats.reduce((sum, stat) => sum + stat.total_revenue, 0);
  const totalUsers = users.length;
  const totalStorageUsed = users.reduce((sum, user) => sum + user.used_gb, 0);

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Проверка прав доступа...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Управление хранилищем</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Icon name="Users" className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Пользователей</p>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Icon name="DollarSign" className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Доход</p>
                  <p className="text-2xl font-bold">{totalRevenue.toLocaleString()} ₽</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Icon name="HardDrive" className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Использовано</p>
                  <p className="text-2xl font-bold">{totalStorageUsed.toFixed(2)} GB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
              onSavePlan={handleSavePlan}
              onDeletePlan={handleDeletePlan}
              onSetDefaultPlan={handleSetDefaultPlan}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <UsersTab
              users={users}
              plans={plans}
              onUpdateUser={handleUpdateUser}
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
    </div>
  );
};

export default AdminStorage;