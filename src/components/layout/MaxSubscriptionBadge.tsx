import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const SETTINGS_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';

interface SubscriptionState {
  paid_until: string | null;
  days_left: number | null;
}

const MaxSubscriptionBadge = () => {
  const [sub, setSub] = useState<SubscriptionState>({ paid_until: null, days_left: null });
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () => {
    fetch(SETTINGS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'max-subscription-get' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.ok) return;
        setSub({ paid_until: d.paid_until, days_left: d.days_left });
        setDraft(d.paid_until || '');
      })
      .catch(() => {});
  };

  useEffect(load, []);

  const save = () => {
    setSaving(true);
    fetch(SETTINGS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'max-subscription-set', paidUntil: draft || null }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.ok) throw new Error();
        setSub({ paid_until: d.paid_until, days_left: d.days_left });
        toast.success(d.paid_until ? 'Дата оплаты MAX сохранена' : 'Дата очищена');
        setOpen(false);
      })
      .catch(() => toast.error('Не удалось сохранить дату'))
      .finally(() => setSaving(false));
  };

  const days = sub.days_left;
  const tone =
    days === null ? 'text-gray-400'
    : days < 0 ? 'text-red-500'
    : days <= 3 ? 'text-red-500'
    : days <= 7 ? 'text-amber-500'
    : 'text-emerald-500';

  const label =
    days === null ? '—'
    : days < 0 ? `−${Math.abs(days)} дн.`
    : `${days} дн.`;

  const hint =
    days === null ? 'Укажите дату оплаты MAX'
    : days < 0 ? `MAX не оплачен ${Math.abs(days)} дн. — уведомления не работают`
    : `MAX оплачен до ${new Date(sub.paid_until as string).toLocaleDateString('ru-RU')}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-1.5 rounded-full px-2 sm:px-3 transition-all duration-300 hover:bg-sky-500/10"
          title={hint}
        >
          <Icon
            name="CalendarClock"
            size={16}
            className={`shrink-0 ${tone} ${days !== null && days <= 1 ? 'animate-pulse' : ''}`}
          />
          <span className={`text-sm font-semibold ${tone}`}>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div>
          <p className="text-sm font-semibold">Подписка MAX</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max-paid-until" className="text-xs">Оплачено до</Label>
          <Input
            id="max-paid-until"
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Напомню за 3 дня, за сутки и в день окончания — на почту, в Telegram и MAX.
        </p>
        <Button onClick={save} disabled={saving} className="w-full" size="sm">
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default MaxSubscriptionBadge;
