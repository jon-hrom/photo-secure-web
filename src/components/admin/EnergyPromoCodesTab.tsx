import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ADMIN_API } from './types';

interface EnergyPromo {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed' | 'energy';
  discount_value: number;
  bonus_energy: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  valid_until: string | null;
  description: string;
  created_at: string;
}

const formatDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('ru-RU') : '∞');

export const EnergyPromoCodesTab = ({ adminKey }: { adminKey: string }) => {
  const [codes, setCodes] = useState<EnergyPromo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<{
    code: string;
    discount_type: 'percent' | 'fixed' | 'energy';
    discount_value: number;
    bonus_energy: number;
    max_uses: string;
    valid_until: string;
    description: string;
  }>({
    code: '',
    discount_type: 'percent',
    discount_value: 10,
    bonus_energy: 0,
    max_uses: '',
    valid_until: '',
    description: '',
  });

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch(`${ADMIN_API}?action=list-energy-promo-codes&admin_key=${adminKey}`);
      if (res.ok) {
        const data = await res.json();
        setCodes(data.promo_codes || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm((f) => ({ ...f, code }));
  };

  const handleCreate = async () => {
    if (!form.code.trim()) {
      toast.error('Введите код промокода');
      return;
    }
    if (form.discount_type === 'energy' && form.bonus_energy <= 0) {
      toast.error('Укажите количество энергии');
      return;
    }
    try {
      const res = await fetch(`${ADMIN_API}?action=create-energy-promo-code&admin_key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          discount_type: form.discount_type,
          discount_value: form.discount_value,
          bonus_energy: form.bonus_energy,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          valid_until: form.valid_until || null,
          description: form.description,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Ошибка создания');
        return;
      }
      toast.success('Промокод создан!');
      setIsCreating(false);
      setForm({ code: '', discount_type: 'percent', discount_value: 10, bonus_energy: 0, max_uses: '', valid_until: '', description: '' });
      load();
    } catch {
      toast.error('Ошибка создания');
    }
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    await fetch(`${ADMIN_API}?action=toggle-energy-promo-code&admin_key=${adminKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: isActive }),
    });
    load();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${ADMIN_API}?action=delete-energy-promo-code&admin_key=${adminKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    toast.success('Промокод удалён');
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Icon name="Zap" className="h-5 w-5 text-yellow-500 shrink-0" />
          Промокоды на энергию ({codes.length})
        </CardTitle>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" onClick={load} disabled={loading} className="shrink-0">
            <Icon name="RefreshCw" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setIsCreating(true)} className="flex-1 sm:flex-none">
            <Icon name="Plus" className="mr-2 h-4 w-4" />
            Создать промокод
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Код</TableHead>
                <TableHead className="min-w-[90px]">Скидка</TableHead>
                <TableHead className="min-w-[110px]">Бонус энергии</TableHead>
                <TableHead className="min-w-[110px]">Использовано</TableHead>
                <TableHead className="min-w-[110px]">Действителен до</TableHead>
                <TableHead className="min-w-[80px]">Статус</TableHead>
                <TableHead className="min-w-[140px]">Описание</TableHead>
                <TableHead className="min-w-[100px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((p) => (
                <TableRow key={p.id} className={p.used_count > 0 ? 'bg-yellow-500/5 border-l-2 border-yellow-500' : ''}>
                  <TableCell className="font-mono font-bold">{p.code}</TableCell>
                  <TableCell>
                    {p.discount_type === 'energy'
                      ? 'Энергия'
                      : p.discount_value > 0
                        ? p.discount_type === 'percent' ? `${p.discount_value}%` : `${p.discount_value} ₽`
                        : '—'}
                  </TableCell>
                  <TableCell>
                    {p.discount_type === 'energy'
                      ? `${p.bonus_energy} ⚡`
                      : p.bonus_energy > 0 ? `+${p.bonus_energy} ⚡` : '—'}
                  </TableCell>
                  <TableCell>
                    {p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ''}
                    {p.max_uses && p.used_count >= p.max_uses && (
                      <Badge variant="destructive" className="ml-2">Исчерпан</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(p.valid_until)}</TableCell>
                  <TableCell>
                    {p.is_active ? <Badge variant="default">Активен</Badge> : <Badge variant="secondary">Неактивен</Badge>}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{p.description || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant={p.is_active ? 'outline' : 'default'} onClick={() => handleToggle(p.id, !p.is_active)}>
                        <Icon name={p.is_active ? 'Pause' : 'Play'} className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(p.id)}>
                        <Icon name="Trash2" className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {codes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Нет промокодов на энергию. Создайте первый!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создать промокод на энергию</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Код промокода</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="ENERGY50"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" onClick={generateCode}>
                    <Icon name="Sparkles" className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Тип скидки</Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v: 'percent' | 'fixed' | 'energy') => setForm({ ...form, discount_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Процент (%)</SelectItem>
                    <SelectItem value="fixed">Фиксированная скидка (₽)</SelectItem>
                    <SelectItem value="energy">Начислить энергию (без оплаты)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Количество энергии {form.discount_type !== 'energy' && '(бонус, доп. единицы)'}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Например: 123"
                  value={form.bonus_energy}
                  onChange={(e) => setForm({ ...form, bonus_energy: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  {form.discount_type === 'energy'
                    ? 'При вводе промокода эта энергия сразу зачисляется на баланс, без оплаты через Робокассу'
                    : 'Сколько энергии добавить сверх оплаченной (бонус)'}
                </p>
              </div>

              {form.discount_type !== 'energy' && (
                <>
                  <div className="space-y-2">
                    <Label>Размер скидки {form.discount_type === 'percent' ? '(%)' : '(₽)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.discount_value}
                      onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">100% — энергия начисляется бесплатно, без оплаты</p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Лимит использований</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Без ограничений"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Действителен до</Label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Описание</Label>
                <Input
                  placeholder="Например: акция на энергию"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>Отмена</Button>
              <Button onClick={handleCreate}>Создать</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default EnergyPromoCodesTab;