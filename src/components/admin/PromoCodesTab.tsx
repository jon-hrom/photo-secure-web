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
import { Badge } from '@/components/ui/badge';

interface PromoCode {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  duration_months: number | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  description: string;
}

interface PromoCodesTabProps {
  promoCodes: PromoCode[];
  onCreatePromoCode: (promoCode: Omit<PromoCode, 'id' | 'used_count' | 'created_at' | 'valid_from'>) => void;
  onTogglePromoCode: (id: number, isActive: boolean) => void;
  onDeletePromoCode: (id: number) => void;
}

export const PromoCodesTab = ({
  promoCodes,
  onCreatePromoCode,
  onTogglePromoCode,
  onDeletePromoCode,
}: PromoCodesTabProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState<Partial<PromoCode>>({
    discount_type: 'percent',
    discount_value: 10,
    duration_months: 1,
    max_uses: null,
    valid_until: null,
    description: '',
  });

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPromoCode({ ...newPromoCode, code });
  };

  const handleCreate = () => {
    if (newPromoCode.code && newPromoCode.discount_value !== undefined) {
      onCreatePromoCode(newPromoCode as Omit<PromoCode, 'id' | 'used_count' | 'created_at' | 'valid_from'>);
      setIsCreating(false);
      setNewPromoCode({
        discount_type: 'percent',
        discount_value: 10,
        duration_months: 1,
        max_uses: null,
        valid_until: null,
        description: '',
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '∞';
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Промокоды ({promoCodes.length})</CardTitle>
        <Button onClick={() => setIsCreating(true)}>
          <Icon name="Plus" className="mr-2 h-4 w-4" />
          Создать промокод
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Код</TableHead>
                <TableHead className="min-w-[100px]">Скидка</TableHead>
                <TableHead className="min-w-[80px]">Срок</TableHead>
                <TableHead className="min-w-[120px]">Использовано</TableHead>
                <TableHead className="min-w-[100px]">Действителен до</TableHead>
                <TableHead className="min-w-[80px]">Статус</TableHead>
                <TableHead className="min-w-[150px]">Описание</TableHead>
                <TableHead className="min-w-[100px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoCodes.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="font-mono font-bold">{promo.code}</TableCell>
                  <TableCell>
                    {promo.discount_type === 'percent'
                      ? `${promo.discount_value}%`
                      : `${promo.discount_value} ₽`}
                  </TableCell>
                  <TableCell>
                    {promo.duration_months ? `${promo.duration_months} мес` : '∞'}
                  </TableCell>
                  <TableCell>
                    {promo.used_count} {promo.max_uses ? `/ ${promo.max_uses}` : ''}
                    {promo.max_uses && promo.used_count >= promo.max_uses && (
                      <Badge variant="destructive" className="ml-2">Исчерпан</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(promo.valid_until)}</TableCell>
                  <TableCell>
                    {promo.is_active ? (
                      <Badge variant="default">Активен</Badge>
                    ) : (
                      <Badge variant="secondary">Неактивен</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {promo.description || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={promo.is_active ? 'outline' : 'default'}
                        onClick={() => onTogglePromoCode(promo.id, !promo.is_active)}
                      >
                        <Icon name={promo.is_active ? 'Pause' : 'Play'} className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDeletePromoCode(promo.id)}
                      >
                        <Icon name="Trash2" className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {promoCodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Нет промокодов. Создайте первый!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создать промокод</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Код промокода</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="SUMMER2024"
                    value={newPromoCode.code || ''}
                    onChange={(e) =>
                      setNewPromoCode({ ...newPromoCode, code: e.target.value.toUpperCase() })
                    }
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" onClick={generateCode}>
                    <Icon name="Sparkles" className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Латиница и цифры, например: SALE50
                </p>
              </div>

              <div className="space-y-2">
                <Label>Тип скидки</Label>
                <Select
                  value={newPromoCode.discount_type}
                  onValueChange={(value: 'percent' | 'fixed') =>
                    setNewPromoCode({ ...newPromoCode, discount_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Процент (%)</SelectItem>
                    <SelectItem value="fixed">Фиксированная сумма (₽)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Размер скидки {newPromoCode.discount_type === 'percent' ? '(%)' : '(₽)'}
                </Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={newPromoCode.discount_value || ''}
                  onChange={(e) =>
                    setNewPromoCode({ ...newPromoCode, discount_value: Number(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Срок действия подписки (месяцев)</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={newPromoCode.duration_months || ''}
                  onChange={(e) =>
                    setNewPromoCode({
                      ...newPromoCode,
                      duration_months: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Оставьте пустым для 1 месяца
                </p>
              </div>

              <div className="space-y-2">
                <Label>Макс. использований</Label>
                <Input
                  type="number"
                  placeholder="Без ограничений"
                  value={newPromoCode.max_uses || ''}
                  onChange={(e) =>
                    setNewPromoCode({
                      ...newPromoCode,
                      max_uses: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Действителен до</Label>
                <Input
                  type="date"
                  value={newPromoCode.valid_until || ''}
                  onChange={(e) =>
                    setNewPromoCode({ ...newPromoCode, valid_until: e.target.value || null })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Оставьте пустым для бессрочного
                </p>
              </div>

              <div className="space-y-2">
                <Label>Описание</Label>
                <Input
                  placeholder="Летняя акция"
                  value={newPromoCode.description || ''}
                  onChange={(e) =>
                    setNewPromoCode({ ...newPromoCode, description: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={!newPromoCode.code || !newPromoCode.discount_value}>
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
