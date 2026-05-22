import { useRetouch } from '@/contexts/RetouchContext';
import type { RetouchPreset } from '@/contexts/retouch-context/types';
import Icon from '@/components/ui/icon';

interface PresetInfo {
  id: RetouchPreset;
  title: string;
  subtitle: string;
  icon: string;
}

const PRESETS: PresetInfo[] = [
  {
    id: 'light',
    title: 'Лёгкая',
    subtitle: 'Чистая кожа, максимум деталей, без размытия',
    icon: 'Feather',
  },
  {
    id: 'medium',
    title: 'Средняя',
    subtitle: 'Баланс: убирает прыщи, объём лица, чёткие глаза',
    icon: 'Sparkles',
  },
  {
    id: 'strong',
    title: 'Сильная',
    subtitle: 'Проблемная кожа: глубокая ретушь + Dodge & Burn',
    icon: 'Wand2',
  },
];

const RetouchPresetSelector = () => {
  const { preset, setPreset } = useRetouch();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Сила ретуши
        </span>
        <span className="text-[10px] text-muted-foreground/70">
          сохраняется автоматически
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`text-left rounded-xl border p-2.5 transition-all ${
                active
                  ? 'border-rose-500 bg-rose-500/10 shadow-sm ring-1 ring-rose-500/40'
                  : 'border-border bg-background/60 hover:border-rose-300 hover:bg-rose-500/5'
              }`}
              aria-pressed={active}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon
                  name={p.icon}
                  size={14}
                  className={active ? 'text-rose-600' : 'text-muted-foreground'}
                />
                <span
                  className={`text-xs font-semibold ${
                    active ? 'text-rose-700 dark:text-rose-300' : 'text-foreground'
                  }`}
                >
                  {p.title}
                </span>
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground line-clamp-3">
                {p.subtitle}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RetouchPresetSelector;
