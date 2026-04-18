import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';
import type { HumanizerSettings, HumanizerStyle, HumanizerAggression } from './types';

interface Props {
  settings: HumanizerSettings;
  onChange: (s: HumanizerSettings) => void;
  disabled?: boolean;
}

const STYLES: { value: HumanizerStyle; label: string; desc: string }[] = [
  { value: 'neutral', label: 'Нейтральный', desc: 'Сдержанный, но живой' },
  { value: 'expert', label: 'Экспертный', desc: 'От первого лица, с опытом' },
  { value: 'business', label: 'Деловой', desc: 'Профессионально, без воды' },
  { value: 'casual', label: 'Разговорный', desc: 'Как другу рассказываете' },
  { value: 'blogger', label: 'Блогерский', desc: 'Эмоции, динамика' },
];

const AGGRESSIONS: { value: HumanizerAggression; label: string; desc: string }[] = [
  { value: 'light', label: 'Мягко', desc: '30% перефраз' },
  { value: 'medium', label: 'Средне', desc: '60% перефраз' },
  { value: 'strong', label: 'Агрессивно', desc: '80% перефраз' },
];

const SettingsPanel = ({ settings, onChange, disabled }: Props) => {
  return (
    <div className="space-y-5">
      <div>
        <Label className="mb-2 block text-sm font-semibold">Стиль текста</Label>
        <RadioGroup
          value={settings.style}
          onValueChange={(v) => onChange({ ...settings, style: v as HumanizerStyle })}
          disabled={disabled}
          className="grid grid-cols-1 gap-2"
        >
          {STYLES.map((s) => (
            <label
              key={s.value}
              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                settings.style === s.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value={s.value} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-semibold">Агрессивность переписывания</Label>
        <RadioGroup
          value={settings.aggression}
          onValueChange={(v) => onChange({ ...settings, aggression: v as HumanizerAggression })}
          disabled={disabled}
          className="grid grid-cols-3 gap-2"
        >
          {AGGRESSIONS.map((a) => (
            <label
              key={a.value}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border cursor-pointer transition-all ${
                settings.aggression === a.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value={a.value} className="sr-only" />
              <div className="font-medium text-sm">{a.label}</div>
              <div className="text-xs text-muted-foreground">{a.desc}</div>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Icon name="GraduationCap" size={14} />
              Академический режим
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Убрать длинные тире (—), букву «ё», английские термины, методологические ошибки
            </p>
          </div>
          <Switch
            checked={settings.academicMode}
            onCheckedChange={(v) => onChange({ ...settings, academicMode: v })}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Icon name="Lock" size={14} />
              Сохранять термины
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Не трогать термины, имена, цифры, названия
            </p>
          </div>
          <Switch
            checked={settings.preserveTerms}
            onCheckedChange={(v) => onChange({ ...settings, preserveTerms: v })}
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Icon name="Target" size={14} />
            Целевой AI-score
          </span>
          <span className="text-primary">{settings.targetScore}%</span>
        </Label>
        <Slider
          value={[settings.targetScore]}
          onValueChange={([v]) => onChange({ ...settings, targetScore: v })}
          min={0}
          max={30}
          step={1}
          disabled={disabled}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Система будет переписывать до этого порога. Рекомендуется 5–10% для гарантии.
        </p>
      </div>
    </div>
  );
};

export default SettingsPanel;
