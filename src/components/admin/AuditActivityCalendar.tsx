import { useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';

interface AuditActivityCalendarProps {
  days: Record<string, number>;
  onSelectDay: (day: string) => void;
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

const AuditActivityCalendar = ({ days, onSelectDay }: AuditActivityCalendarProps) => {
  // Стартовый месяц — самый свежий день с активностью, иначе текущий
  const initial = useMemo(() => {
    const keys = Object.keys(days).sort();
    const base = keys.length ? new Date(keys[keys.length - 1] + 'T00:00:00') : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  }, [days]);

  const [view, setView] = useState(initial);

  const maxCount = useMemo(() => {
    const vals = Object.values(days);
    return vals.length ? Math.max(...vals) : 0;
  }, [days]);

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Пн=0
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [view]);

  const intensity = (count: number) => {
    if (!count || maxCount === 0) return 'bg-muted/40 text-muted-foreground';
    const ratio = count / maxCount;
    if (ratio > 0.66) return 'bg-primary text-primary-foreground';
    if (ratio > 0.33) return 'bg-primary/60 text-primary-foreground';
    return 'bg-primary/25';
  };

  const prevMonth = () =>
    setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }));
  const nextMonth = () =>
    setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <Icon name="ChevronLeft" size={18} />
        </button>
        <div className="font-semibold text-sm">
          {MONTHS[view.month]} {view.year}
        </div>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <Icon name="ChevronRight" size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[11px] text-muted-foreground py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = dayKey(view.year, view.month, d);
          const count = days[key] || 0;
          const active = count > 0;
          return (
            <button
              key={i}
              disabled={!active}
              onClick={() => active && onSelectDay(key)}
              title={active ? `${count} действий` : 'Нет активности'}
              className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center transition-all ${intensity(count)} ${
                active ? 'cursor-pointer hover:ring-2 hover:ring-primary/50' : 'cursor-default opacity-70'
              }`}
            >
              <span className="font-medium">{d}</span>
              {active && <span className="text-[9px] leading-none mt-0.5">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
        <span>Меньше</span>
        <div className="w-3 h-3 rounded bg-muted/40" />
        <div className="w-3 h-3 rounded bg-primary/25" />
        <div className="w-3 h-3 rounded bg-primary/60" />
        <div className="w-3 h-3 rounded bg-primary" />
        <span>Больше</span>
      </div>
    </div>
  );
};

export default AuditActivityCalendar;
