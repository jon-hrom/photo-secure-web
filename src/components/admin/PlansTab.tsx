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
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

interface Plan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  price_rub: number;
  is_active: boolean;
  created_at: string;
}

interface PlansTabProps {
  plans: Plan[];
  onSavePlan: (plan: Partial<Plan>) => void;
  onDeletePlan: (planId: number) => void;
  onSetDefaultPlan: (planId: number) => void;
}

export const PlansTab = ({ plans, onSavePlan, onDeletePlan, onSetDefaultPlan }: PlansTabProps) => {
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null);

  const handleSave = () => {
    if (editingPlan) {
      onSavePlan(editingPlan);
      setEditingPlan(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Тарифные планы</CardTitle>
          <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingPlan({ is_active: true })}>
                <Icon name="Plus" className="mr-2 h-4 w-4" />
                Создать тариф
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingPlan?.plan_id ? 'Редактировать' : 'Создать'} тариф</DialogTitle>
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
                  <Label>Квота (GB)</Label>
                  <Input
                    type="number"
                    value={editingPlan?.quota_gb || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, quota_gb: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Цена (₽/месяц)</Label>
                  <Input
                    type="number"
                    value={editingPlan?.price_rub || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price_rub: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingPlan?.is_active || false}
                    onChange={(e) => setEditingPlan({ ...editingPlan, is_active: e.target.checked })}
                  />
                  <Label>Активен</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingPlan(null)}>
                  Отмена
                </Button>
                <Button onClick={handleSave}>Сохранить</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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
                <TableCell>{plan.quota_gb} GB</TableCell>
                <TableCell>{plan.price_rub} ₽/мес</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${plan.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {plan.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingPlan(plan)}
                    >
                      <Icon name="Edit" className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeletePlan(plan.plan_id)}
                    >
                      <Icon name="Trash2" className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onSetDefaultPlan(plan.plan_id)}
                      title="Назначить всем пользователям без тарифа"
                    >
                      <Icon name="UserPlus" className="h-4 w-4 mr-1" />
                      Назначить всем
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
