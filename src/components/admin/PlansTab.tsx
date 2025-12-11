import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
  visible_to_users: boolean;
  created_at: string;
  max_clients?: number;
  description?: string;
  stats_enabled?: boolean;
  track_storage_usage?: boolean;
  track_client_count?: boolean;
  track_booking_analytics?: boolean;
  track_revenue?: boolean;
  track_upload_history?: boolean;
  track_download_stats?: boolean;
}

interface PlansTabProps {
  plans: Plan[];
  onSavePlan: (plan: Partial<Plan>) => Promise<void>;
  onDeletePlan: (planId: number) => void;
  onSetDefaultPlan: (planId: number) => void;
}

export const PlansTab = ({ plans, onSavePlan, onDeletePlan, onSetDefaultPlan }: PlansTabProps) => {
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (editingPlan && !saving) {
      setSaving(true);
      try {
        await onSavePlan(editingPlan);
        setEditingPlan(null);
      } catch (error) {
        console.error('Save error:', error);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Тарифные планы</CardTitle>
          <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingPlan({ 
                is_active: true, 
                visible_to_users: false,
                stats_enabled: true,
                track_storage_usage: true,
                track_client_count: true,
                track_booking_analytics: true,
                track_revenue: true,
                track_upload_history: true,
                track_download_stats: true
              })}>
                <Icon name="Plus" className="mr-2 h-4 w-4" />
                Создать тариф
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPlan?.plan_id ? 'Редактировать' : 'Создать'} тариф</DialogTitle>
                <CardDescription>Настройте параметры тарифного плана</CardDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Основные параметры */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Icon name="Settings" className="h-4 w-4" />
                    Основные параметры
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Название</Label>
                      <Input
                        value={editingPlan?.plan_name || ''}
                        onChange={(e) => setEditingPlan({ ...editingPlan, plan_name: e.target.value })}
                        placeholder="Базовый"
                      />
                    </div>
                    <div>
                      <Label>Цена (₽/месяц)</Label>
                      <Input
                        type="number"
                        value={editingPlan?.price_rub || ''}
                        onChange={(e) => setEditingPlan({ ...editingPlan, price_rub: Number(e.target.value) })}
                        placeholder="990"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Описание</Label>
                    <Input
                      value={editingPlan?.description || ''}
                      onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                      placeholder="Для небольших студий"
                    />
                  </div>
                </div>

                <Separator />

                {/* Лимиты */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Icon name="Gauge" className="h-4 w-4" />
                    Лимиты
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-2">
                        <Icon name="HardDrive" className="h-4 w-4 text-muted-foreground" />
                        Объем хранилища (GB)
                      </Label>
                      <Input
                        type="number"
                        value={editingPlan?.quota_gb || ''}
                        onChange={(e) => setEditingPlan({ ...editingPlan, quota_gb: Number(e.target.value) })}
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">
                        <Icon name="Users" className="h-4 w-4 text-muted-foreground" />
                        Макс. клиентов
                      </Label>
                      <Input
                        type="number"
                        value={editingPlan?.max_clients || ''}
                        onChange={(e) => setEditingPlan({ ...editingPlan, max_clients: Number(e.target.value) })}
                        placeholder="∞ (если пусто)"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Статистика и аналитика */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Icon name="BarChart3" className="h-4 w-4" />
                        Статистика и аналитика
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">Выберите, какие метрики будут доступны в этом тарифе</p>
                    </div>
                    <Switch
                      checked={editingPlan?.stats_enabled ?? true}
                      onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, stats_enabled: checked })}
                    />
                  </div>
                  
                  {editingPlan?.stats_enabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-muted">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon name="HardDrive" className="h-4 w-4 text-muted-foreground" />
                          <Label className="font-normal cursor-pointer">Использование хранилища</Label>
                        </div>
                        <Switch
                          checked={editingPlan?.track_storage_usage ?? true}
                          onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, track_storage_usage: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon name="Users" className="h-4 w-4 text-muted-foreground" />
                          <Label className="font-normal cursor-pointer">Количество клиентов</Label>
                        </div>
                        <Switch
                          checked={editingPlan?.track_client_count ?? true}
                          onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, track_client_count: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon name="Calendar" className="h-4 w-4 text-muted-foreground" />
                          <Label className="font-normal cursor-pointer">Аналитика бронирований</Label>
                        </div>
                        <Switch
                          checked={editingPlan?.track_booking_analytics ?? true}
                          onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, track_booking_analytics: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon name="DollarSign" className="h-4 w-4 text-muted-foreground" />
                          <Label className="font-normal cursor-pointer">Доходы и выручка</Label>
                        </div>
                        <Switch
                          checked={editingPlan?.track_revenue ?? true}
                          onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, track_revenue: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon name="Upload" className="h-4 w-4 text-muted-foreground" />
                          <Label className="font-normal cursor-pointer">История загрузок</Label>
                        </div>
                        <Switch
                          checked={editingPlan?.track_upload_history ?? true}
                          onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, track_upload_history: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon name="Download" className="h-4 w-4 text-muted-foreground" />
                          <Label className="font-normal cursor-pointer">Статистика скачиваний</Label>
                        </div>
                        <Switch
                          checked={editingPlan?.track_download_stats ?? true}
                          onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, track_download_stats: checked })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Видимость и активность */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Icon name="Eye" className="h-4 w-4" />
                    Видимость и статус
                  </h3>
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Тариф активен</Label>
                    <Switch
                      checked={editingPlan?.is_active || false}
                      onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, is_active: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Видим пользователям</Label>
                    <Switch
                      checked={editingPlan?.visible_to_users || false}
                      onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, visible_to_users: checked })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingPlan(null)} disabled={saving}>
                  Отмена
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </Button>
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
              <TableHead>Клиенты</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Статистика</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.plan_id}>
                <TableCell className="font-mono text-xs">{plan.plan_id}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{plan.plan_name}</div>
                    {plan.description && <div className="text-xs text-muted-foreground">{plan.description}</div>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Icon name="HardDrive" className="h-3 w-3 text-muted-foreground" />
                    <span>{plan.quota_gb} ГБ</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Icon name="Users" className="h-3 w-3 text-muted-foreground" />
                    <span>{plan.max_clients || '∞'}</span>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">{plan.price_rub} ₽/мес</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {plan.stats_enabled ? (
                      <>
                        {plan.track_storage_usage && <Badge variant="outline" className="text-xs"><Icon name="HardDrive" className="h-3 w-3" /></Badge>}
                        {plan.track_client_count && <Badge variant="outline" className="text-xs"><Icon name="Users" className="h-3 w-3" /></Badge>}
                        {plan.track_booking_analytics && <Badge variant="outline" className="text-xs"><Icon name="Calendar" className="h-3 w-3" /></Badge>}
                        {plan.track_revenue && <Badge variant="outline" className="text-xs"><Icon name="DollarSign" className="h-3 w-3" /></Badge>}
                        {plan.track_upload_history && <Badge variant="outline" className="text-xs"><Icon name="Upload" className="h-3 w-3" /></Badge>}
                        {plan.track_download_stats && <Badge variant="outline" className="text-xs"><Icon name="Download" className="h-3 w-3" /></Badge>}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Отключена</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant={plan.is_active ? 'default' : 'secondary'} className="text-xs justify-center">
                      {plan.is_active ? 'Активен' : 'Неактивен'}
                    </Badge>
                    <Badge variant={plan.visible_to_users ? 'outline' : 'secondary'} className="text-xs justify-center">
                      {plan.visible_to_users ? 'Видим' : 'Скрыт'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
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