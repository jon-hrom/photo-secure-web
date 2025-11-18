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
  onUpdateUser: (user: Partial<User>) => void;
}

export const UsersTab = ({ users, plans, onUpdateUser }: UsersTabProps) => {
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);

  const handleSave = () => {
    if (editingUser) {
      onUpdateUser(editingUser);
      setEditingUser(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пользователи ({users.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Имя</TableHead>
              <TableHead>Тариф</TableHead>
              <TableHead>Использовано</TableHead>
              <TableHead>Квота</TableHead>
              <TableHead>Действия</TableHead>
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
                        onClick={() => setEditingUser(user)}
                      >
                        <Icon name="Edit" className="h-4 w-4" />
                      </Button>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Редактировать пользователя: {user.username}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Тариф</Label>
                            <select
                              className="w-full border rounded px-3 py-2"
                              value={editingUser?.plan_id || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, plan_id: Number(e.target.value) })}
                            >
                              <option value="">Без тарифа</option>
                              {plans.map((plan) => (
                                <option key={plan.plan_id} value={plan.plan_id}>
                                  {plan.plan_name} ({plan.quota_gb} GB)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label>Индивидуальная квота (GB)</Label>
                            <Input
                              type="number"
                              placeholder="Оставьте пустым для стандартной квоты"
                              value={editingUser?.custom_quota_gb || ''}
                              onChange={(e) =>
                                setEditingUser({
                                  ...editingUser,
                                  custom_quota_gb: e.target.value ? Number(e.target.value) : null
                                })
                              }
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditingUser(null)}>
                            Отмена
                          </Button>
                          <Button onClick={handleSave}>Сохранить</Button>
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
  );
};