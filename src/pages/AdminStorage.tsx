import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { PlansTab } from '@/components/admin/PlansTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { StatsTab } from '@/components/admin/StatsTab';
import { FinancialTab } from '@/components/admin/FinancialTab';

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
  const { toast } = useToast();

  const adminKey = localStorage.getItem('adminKey') || '';

  useEffect(() => {
    fetchPlans();
    fetchUsers();
    fetchStats();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${ADMIN_API}?action=list-plans`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить тарифы', variant: 'destructive' });
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${ADMIN_API}?action=list-users&limit=100&offset=0`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить пользователей', variant: 'destructive' });
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [usageRes, revenueRes] = await Promise.all([
        fetch(`${ADMIN_API}?action=usage-stats&days=30`, {
          headers: { 'X-Admin-Key': adminKey }
        }),
        fetch(`${ADMIN_API}?action=revenue-stats`, {
          headers: { 'X-Admin-Key': adminKey }
        })
      ]);

      const usageData = await usageRes.json();
      const revenueData = await revenueRes.json();

      setUsageStats(usageData.stats || []);
      setRevenueStats(revenueData.revenue || []);
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить статистику', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialStats = async (period: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${ADMIN_API}?action=financial-stats&period=${period}`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      const data = await res.json();
      setFinancialStats(data.stats || []);
      setFinancialSummary(data.summary || null);
    } catch (error) {
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

  const handleUpdateUser = async (editingUser: Partial<User>) => {
    if (!editingUser?.user_id) return;

    try {
      await fetch(`${ADMIN_API}?action=update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({
          user_id: editingUser.user_id,
          plan_id: editingUser.plan_id,
          custom_quota_gb: editingUser.custom_quota_gb
        })
      });

      toast({ title: 'Успешно', description: 'Пользователь обновлен' });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось обновить пользователя', variant: 'destructive' });
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Управление хранилищем</h1>
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
          <TabsList>
            <TabsTrigger value="plans">
              <Icon name="Package" className="mr-2 h-4 w-4" />
              Тарифы
            </TabsTrigger>
            <TabsTrigger value="users">
              <Icon name="Users" className="mr-2 h-4 w-4" />
              Пользователи
            </TabsTrigger>
            <TabsTrigger value="stats">
              <Icon name="BarChart" className="mr-2 h-4 w-4" />
              Статистика
            </TabsTrigger>
            <TabsTrigger value="financial">
              <Icon name="DollarSign" className="mr-2 h-4 w-4" />
              Финансы
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