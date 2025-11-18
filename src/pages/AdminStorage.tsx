import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const ADMIN_API = 'https://functions.poehali.dev/81fe316e-43c6-4e9f-93e2-63032b5c552c';

interface Plan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  price_rub: number;
  is_active: boolean;
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AdminStorage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStat[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);

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

  const handleSavePlan = async () => {
    if (!editingPlan) return;

    try {
      const action = editingPlan.plan_id ? 'update-plan' : 'create-plan';
      await fetch(`${ADMIN_API}?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify(editingPlan)
      });

      toast({ title: 'Успешно', description: 'Тариф сохранен' });
      setEditingPlan(null);
      fetchPlans();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить тариф', variant: 'destructive' });
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

  const handleUpdateUser = async () => {
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
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось обновить пользователя', variant: 'destructive' });
    }
  };

  const totalRevenue = revenueStats.reduce((sum, stat) => sum + stat.total_revenue, 0);
  const totalUsers = users.length;
  const totalStorageUsed = users.reduce((sum, user) => sum + user.used_gb, 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Админ-панель хранилища</h1>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Админ-ключ"
              value={adminKey}
              onChange={(e) => localStorage.setItem('adminKey', e.target.value)}
              className="w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Пользователи</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Icon name="Users" size={20} className="text-primary" />
                <span className="text-2xl font-bold">{totalUsers}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Используется</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Icon name="HardDrive" size={20} className="text-blue-500" />
                <span className="text-2xl font-bold">{totalStorageUsed.toFixed(1)} ГБ</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Доход</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Icon name="TrendingUp" size={20} className="text-green-500" />
                <span className="text-2xl font-bold">{totalRevenue.toLocaleString()} ₽</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Тарифы</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Icon name="Package" size={20} className="text-orange-500" />
                <span className="text-2xl font-bold">{plans.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="plans" className="space-y-4">
          <TabsList>
            <TabsTrigger value="plans">Тарифы</TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
            <TabsTrigger value="stats">Статистика</TabsTrigger>
            <TabsTrigger value="revenue">Доходы</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Тарифные планы</CardTitle>
                <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingPlan({ is_active: true })}>
                      <Icon name="Plus" className="mr-2" size={16} />
                      Добавить тариф
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingPlan?.plan_id ? 'Редактировать тариф' : 'Новый тариф'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Название</Label>
                        <Input
                          value={editingPlan?.plan_name || ''}
                          onChange={(e) => setEditingPlan({ ...editingPlan, plan_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Квота (ГБ)</Label>
                        <Input
                          type="number"
                          value={editingPlan?.quota_gb || ''}
                          onChange={(e) => setEditingPlan({ ...editingPlan, quota_gb: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Цена (₽)</Label>
                        <Input
                          type="number"
                          value={editingPlan?.price_rub || ''}
                          onChange={(e) => setEditingPlan({ ...editingPlan, price_rub: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleSavePlan}>Сохранить</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Название</TableHead>
                      <TableHead>Квота</TableHead>
                      <TableHead>Цена</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.plan_id}>
                        <TableCell>{plan.plan_id}</TableCell>
                        <TableCell className="font-medium">{plan.plan_name}</TableCell>
                        <TableCell>{plan.quota_gb} ГБ</TableCell>
                        <TableCell>{plan.price_rub} ₽</TableCell>
                        <TableCell>
                          {plan.is_active ? (
                            <span className="text-green-600">Активен</span>
                          ) : (
                            <span className="text-muted-foreground">Неактивен</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setEditingPlan(plan)}>
                              <Icon name="Edit" size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePlan(plan.plan_id)}
                            >
                              <Icon name="Trash2" size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Пользователи</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Имя</TableHead>
                      <TableHead>Тариф</TableHead>
                      <TableHead>Квота</TableHead>
                      <TableHead>Использовано</TableHead>
                      <TableHead>Процент</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const quota = user.custom_quota_gb || plans.find(p => p.plan_id === user.plan_id)?.quota_gb || 0;
                      const percent = (user.used_gb / quota) * 100;
                      return (
                        <TableRow key={user.user_id}>
                          <TableCell>{user.user_id}</TableCell>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.plan_name}</TableCell>
                          <TableCell>
                            {user.custom_quota_gb ? (
                              <span className="text-primary">{user.custom_quota_gb} ГБ*</span>
                            ) : (
                              <span>{quota} ГБ</span>
                            )}
                          </TableCell>
                          <TableCell>{user.used_gb.toFixed(2)} ГБ</TableCell>
                          <TableCell>
                            <span className={percent > 80 ? 'text-destructive font-medium' : ''}>
                              {percent.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Dialog open={editingUser?.user_id === user.user_id} onOpenChange={(open) => !open && setEditingUser(null)}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setEditingUser(user)}>
                                  <Icon name="Settings" size={16} />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Редактировать {user.username}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Тариф</Label>
                                    <select
                                      className="w-full p-2 border rounded"
                                      value={editingUser?.plan_id || user.plan_id}
                                      onChange={(e) => setEditingUser({ ...editingUser, plan_id: parseInt(e.target.value) })}
                                    >
                                      {plans.map(p => (
                                        <option key={p.plan_id} value={p.plan_id}>{p.plan_name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <Label>Индивидуальная квота (ГБ)</Label>
                                    <Input
                                      type="number"
                                      placeholder="Оставьте пустым для использования квоты тарифа"
                                      value={editingUser?.custom_quota_gb ?? ''}
                                      onChange={(e) => setEditingUser({
                                        ...editingUser,
                                        custom_quota_gb: e.target.value ? parseFloat(e.target.value) : null
                                      })}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button onClick={handleUpdateUser}>Сохранить</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Статистика загрузок за 30 дней</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <Icon name="Loader2" className="animate-spin" size={32} />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Объем загрузок</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={usageStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="total_size_gb" stroke="#8884d8" name="ГБ загружено" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">Количество загрузок</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={usageStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="uploads" fill="#82ca9d" name="Загрузок" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">Активные пользователи</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={usageStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="unique_users" stroke="#ff7300" name="Пользователей" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Доходы по тарифам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Распределение доходов</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={revenueStats}
                          dataKey="total_revenue"
                          nameKey="plan_name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.plan_name}: ${entry.total_revenue}₽`}
                        >
                          {revenueStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Детализация по тарифам</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Тариф</TableHead>
                          <TableHead>Пользователей</TableHead>
                          <TableHead>Доход</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revenueStats.map((stat, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{stat.plan_name}</TableCell>
                            <TableCell>{stat.users_count}</TableCell>
                            <TableCell className="text-green-600 font-semibold">
                              {stat.total_revenue.toLocaleString()} ₽
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold">
                          <TableCell>ИТОГО</TableCell>
                          <TableCell>{revenueStats.reduce((sum, s) => sum + s.users_count, 0)}</TableCell>
                          <TableCell className="text-green-600">
                            {totalRevenue.toLocaleString()} ₽
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminStorage;