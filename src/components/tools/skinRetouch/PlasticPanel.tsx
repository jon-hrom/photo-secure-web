import Icon from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import { PlasticParams, PLASTIC_ZERO, isPlasticZero } from '@/components/tools/skinRetouch/plastic';

interface Props {
  value: PlasticParams;
  onChange: (v: PlasticParams) => void;
  disabled?: boolean;
  /** Статус живого применения к результату */
  status?: 'idle' | 'detecting' | 'applying' | 'ready';
  found?: { faces: number; bodies: number } | null;
  hint?: string;
}

const ROWS: { key: keyof PlasticParams; label: string; icon: string; tip: string }[] = [
  { key: 'chin', label: 'Второй подбородок', icon: 'ScanFace', tip: 'Подтягивает складку под челюстью к шее' },
  { key: 'shoulders', label: 'Плечи', icon: 'ChevronsDown', tip: 'Опускает и чуть сужает линию плеч' },
  { key: 'arms', label: 'Руки', icon: 'Minimize2', tip: 'Стройнит плечо и предплечье к оси руки' },
  { key: 'waist', label: 'Талия', icon: 'Hourglass', tip: 'Подтягивает бока с двух сторон' },
];

const PRESETS: { label: string; v: PlasticParams }[] = [
  { label: 'Выкл', v: PLASTIC_ZERO },
  { label: 'Слегка', v: { chin: 40, shoulders: 25, arms: 25, waist: 25 } },
  { label: 'Средне', v: { chin: 65, shoulders: 45, arms: 45, waist: 45 } },
  { label: 'Заметно', v: { chin: 90, shoulders: 70, arms: 70, waist: 70 } },
];

const PlasticPanel = ({ value, onChange, disabled, status, found, hint }: Props) => {
  const off = isPlasticZero(value);
  return (
    <div className={`rounded-lg border p-3 space-y-3 ${off ? 'border-border' : 'border-primary/60 bg-primary/5'}`}>
      <div className="flex items-center gap-2">
        <Icon name="Wand2" size={16} className={off ? 'text-muted-foreground' : 'text-primary'} />
        <p className="text-xs font-medium flex-1">Пластика</p>
        {status === 'detecting' && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon name="Loader2" size={12} className="animate-spin" /> ищем фигуру...
          </span>
        )}
        {status === 'applying' && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon name="Loader2" size={12} className="animate-spin" /> применяем...
          </span>
        )}
        {status === 'ready' && found && !off && (
          <span className="text-[11px] text-muted-foreground">
            лиц: {found.faces}, фигур: {found.bodies}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = ROWS.every((r) => value[r.key] === p.v[r.key]);
          return (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.v)}
              className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-60 ${
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {ROWS.map((r) => (
          <div key={r.key}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name={r.icon} size={13} className="text-muted-foreground" />
              <span className="text-[11px] font-medium">{r.label}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">— {r.tip}</span>
              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground w-8 text-right">{value[r.key]}</span>
            </div>
            <Slider
              value={[value[r.key]]}
              min={0}
              max={100}
              step={5}
              disabled={disabled}
              onValueChange={([v]) => onChange({ ...value, [r.key]: v })}
            />
          </div>
        ))}
      </div>

      {(found && found.bodies === 0 && !off && (value.shoulders || value.arms || value.waist)) ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-500">
          Фигура в кадре не найдена — плечи, руки и талия не изменятся. Подбородок работает по лицу.
        </p>
      ) : null}
      <p className="text-[10px] text-muted-foreground">
        {hint || 'Бесплатно и мгновенно — двигайте ползунки, результат обновится сразу. Черты лица не меняются.'}
      </p>
    </div>
  );
};

export default PlasticPanel;
