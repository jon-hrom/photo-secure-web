import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface Slot {
  name: string;
  v: PlasticParams | null;
}

const STORAGE_KEY = 'plastic_presets_v1';
const ACTIVE_KEY = 'plastic_presets_active_v1';
const DEFAULT_SLOTS: Slot[] = [
  { name: 'Настройка 1', v: null },
  { name: 'Настройка 2', v: null },
];

const loadSlots = (): Slot[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SLOTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_SLOTS;
};

const loadActive = (): number => {
  const n = Number(localStorage.getItem(ACTIVE_KEY));
  return n === 1 ? 1 : 0;
};

const PlasticPanel = ({ value, onChange, disabled, status, found, hint }: Props) => {
  const off = isPlasticZero(value);
  const [slots, setSlots] = useState<Slot[]>(loadSlots);
  const [active, setActive] = useState<number>(loadActive);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  }, [slots]);
  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, String(active));
  }, [active]);

  const save = () => {
    setSlots((s) => s.map((slot, i) => (i === active ? { ...slot, v: { ...value } } : slot)));
    toast.success(`Сохранено в «${slots[active].name}»`);
  };

  const pick = (i: number) => {
    setActive(i);
    const v = slots[i].v;
    if (v) onChange({ ...v });
    else toast.info(`«${slots[i].name}» пока пуста — настройте ползунки и нажмите «Сохранить»`);
  };

  const startRename = () => {
    setDraftName(slots[active].name);
    setRenaming(true);
  };

  const commitRename = () => {
    const name = draftName.trim().slice(0, 30);
    if (name) setSlots((s) => s.map((slot, i) => (i === active ? { ...slot, name } : slot)));
    setRenaming(false);
  };

  const activeSlot = slots[active];
  const matchesSaved = !!activeSlot.v && ROWS.every((r) => activeSlot.v![r.key] === value[r.key]);

  return (
    <div className={`rounded-lg border p-3 space-y-3 ${off ? 'border-border' : 'border-primary/60 bg-primary/5'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Icon name="Wand2" size={16} className={off ? 'text-muted-foreground' : 'text-primary'} />
        <p className="text-xs font-medium">Пластика</p>
        <button
          type="button"
          disabled={disabled}
          onClick={save}
          title={`Сохранить текущие значения в «${activeSlot.name}»`}
          className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-60 ${
            matchesSaved ? 'border-primary/40 text-primary' : 'border-border hover:border-primary/60 hover:text-primary'
          }`}
        >
          <Icon name={matchesSaved ? 'Check' : 'Save'} size={12} />
          {matchesSaved ? 'Сохранено' : 'Сохранить настройки'}
        </button>

        <div className="flex-1 flex justify-center">
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

        {renaming ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draftName}
              maxLength={30}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              onBlur={commitRename}
              className="h-6 w-32 rounded-md border border-primary bg-background px-2 text-[11px] outline-none"
            />
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] hover:border-primary/60 disabled:opacity-60 max-w-[160px]"
              >
                <span className="truncate">{activeSlot.name}</span>
                <Icon name="ChevronDown" size={12} className="shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              {slots.map((s, i) => (
                <DropdownMenuItem key={i} onSelect={() => pick(i)} className="flex items-center gap-2 text-xs">
                  <Icon name="Check" size={12} className={i === active ? 'text-primary' : 'opacity-0'} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {s.v ? ROWS.map((r) => s.v![r.key]).join(' · ') : 'пусто'}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={startRename} className="flex items-center gap-2 text-xs">
                <Icon name="Pencil" size={12} />
                Переименовать «{activeSlot.name}»
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
