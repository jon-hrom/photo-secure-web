import Icon from '@/components/ui/icon';
import type { Person } from '@/components/tools/skinRetouch/plastic';

interface Props {
  people: Person[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  status: 'idle' | 'detecting' | 'ready';
  disabled?: boolean;
}

/** Миниатюры найденных лиц: нажатое — человек обрабатывается, отжатое — не трогаем. */
const PeoplePicker = ({ people, selected, onToggle, status, disabled }: Props) => {
  if (status === 'detecting') {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Icon name="Loader2" size={14} className="animate-spin" /> Ищем людей на фото...
      </div>
    );
  }
  if (status !== 'ready') return null;
  if (!people.length) {
    return <p className="text-[11px] text-muted-foreground">Лица не найдены — обработка пойдёт по всему фото.</p>;
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium">
        Кого обрабатываем
        <span className="font-normal text-muted-foreground"> — нажмите на лицо, чтобы включить или выключить</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {people.map((p, i) => {
          const on = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(p.id)}
              aria-pressed={on}
              title={on ? 'Обрабатывается — нажмите, чтобы не трогать' : 'Не обрабатывается — нажмите, чтобы включить'}
              className={`relative h-14 w-14 rounded-lg overflow-hidden border-2 transition-all duration-150 disabled:opacity-60 ${
                on
                  ? 'border-primary ring-2 ring-primary/40 scale-95 shadow-inner'
                  : 'border-border opacity-50 grayscale shadow-md hover:opacity-80'
              }`}
            >
              <img src={p.thumb} alt={`Человек ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
              <span
                className={`absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                  on ? 'bg-primary text-primary-foreground' : 'bg-background/90 text-muted-foreground'
                }`}
              >
                {on ? <Icon name="Check" size={10} /> : i + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PeoplePicker;
