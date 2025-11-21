import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface UsersTabProps {
  users: User[];
  plans: Plan[];
  onUpdateUser: (user: Partial<User> & { custom_price?: number; started_at?: string; ended_at?: string }) => void;
}

export const UsersTab = ({ users, plans, onUpdateUser }: UsersTabProps) => {
  const [editingUser, setEditingUser] = useState<Partial<User> & { custom_price?: number; started_at?: string; ended_at?: string } | null>(null);

  const handleSave = () => {
    if (editingUser) {
      onUpdateUser(editingUser);
      setEditingUser(null);
    }
  };

  const handleOpenDialog = (user: User) => {
    const plan = plans.find(p => p.plan_id === user.plan_id);
    setEditingUser({
      ...user,
      custom_price: plan?.price_rub,
      started_at: new Date().toISOString().split('T')[0],
      ended_at: ''
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пользователи ({users.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[60px]">ID</TableHead>
                <TableHead className="min-w-[150px]">Имя</TableHead>
                <TableHead className="min-w-[120px]">Тариф</TableHead>
                <TableHead className="min-w-[120px]">Использовано</TableHead>
                <TableHead className="min-w-[100px]">Квота</TableHead>
                <TableHead className="min-w-[100px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const plan = plans.find(p => p.plan_id === user.plan_id);
                const quota = user.custom_quota_gb || plan?.quota_gb || 0;
                const percentage = quota > 0 ? (user.used_gb / quota * 100).toFixed(1) : 0;

                return (
                  <TableRow key={user.user_id}>
                    <TableCell>{user.user_id}</TableCell>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.plan_name || 'Без тарифа'}</TableCell>
                    <TableCell>
                      {user.used_gb.toFixed(2)} GB ({percentage}%)
                    </TableCell>
                    <TableCell>
                      {user.custom_quota_gb ? (
                        <span className="text-blue-600 font-semibold">{user.custom_quota_gb} GB (custom)</span>
                      ) : (
                        <span>{quota} GB</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Dialog open={editingUser?.user_id === user.user_id} onOpenChange={(open) => !open && setEditingUser(null)}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(user)}
                        >
                          <Icon name="Edit" className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Редактировать</span>
                        </Button>
                        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Назначить тариф: {user.username}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Тарифный план</Label>
                              <Select
                                value={editingUser?.plan_id?.toString() || ''}
                                onValueChange={(value) => {
                                  const planId = value ? Number(value) : null;
                                  const selectedPlan = plans.find(p => p.plan_id === planId);
                                  setEditingUser({
                                    ...editingUser,
                                    plan_id: planId,
                                    custom_price: selectedPlan?.price_rub || 0
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Выберите тариф" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Без тарифа</SelectItem>
                                  {plans.map((plan) => (
                                    <SelectItem key={plan.plan_id} value={plan.plan_id.toString()}>
                                      {plan.plan_name} — {plan.quota_gb} GB — {plan.price_rub} ₽/мес
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {editingUser?.plan_id && (
                              <>
                                <div className="space-y-2">
                                  <Label>Индивидуальная цена (₽/месяц)</Label>
                                  <Input
                                    type="number"
                                    placeholder="Цена по умолчанию из тарифа"
                                    value={editingUser?.custom_price || ''}
                                    onChange={(e) =>
                                      setEditingUser({
                                        ...editingUser,
                                        custom_price: e.target.value ? Number(e.target.value) : undefined
                                      })
                                    }
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Оставьте пустым для цены из тарифа
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label>Индивидуальная квота (GB)</Label>
                                  <Input
                                    type="number"
                                    placeholder="Квота по умолчанию из тарифа"
                                    value={editingUser?.custom_quota_gb || ''}
                                    onChange={(e) =>
                                      setEditingUser({
                                        ...editingUser,
                                        custom_quota_gb: e.target.value ? Number(e.target.value) : null
                                      })
                                    }
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Оставьте пустым для квоты из тарифа
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label>Дата начала подписки</Label>
                                  <Input
                                    type="date"
                                    value={editingUser?.started_at || ''}
                                    onChange={(e) =>
                                      setEditingUser({
                                        ...editingUser,
                                        started_at: e.target.value
                                      })
                                    }
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    С какой даты начнётся подписка
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label>Дата окончания подписки (опционально)</Label>
                                  <Input
                                    type="date"
                                    value={editingUser?.ended_at || ''}
                                    onChange={(e) =>
                                      setEditingUser({
                                        ...editingUser,
                                        ended_at: e.target.value
                                      })
                                    }
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Оставьте пустым для бессрочной подписки
                                  </p>
                                </div>
                              </>
                            )}

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                              <p className="text-sm font-semibold text-blue-900">
                                <Icon name="Info" className="inline h-4 w-4 mr-1" />
                                Информация
                              </p>
                              <p className="text-xs text-blue-700">
                                • Индивидуальная цена перезаписывает цену из тарифа
                              </p>
                              <p className="text-xs text-blue-700">
                                • Индивидуальная квота перезаписывает квоту из тарифа
                              </p>
                              <p className="text-xs text-blue-700">
                                • Подписка будет активна с указанной даты
                              </p>
                            </div>
                          </div>
                          <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setEditingUser(null)}>
                              Отмена
                            </Button>
                            <Button onClick={handleSave}>
                              <Icon name="Save" className="mr-2 h-4 w-4" />
                              Сохранить
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
