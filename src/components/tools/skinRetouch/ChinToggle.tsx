import Icon from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';

interface ChinToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

const ChinToggle = ({ value, onChange, disabled, compact }: ChinToggleProps) => (
  <label
    className={`flex items-center gap-3 rounded-lg border transition-colors cursor-pointer ${
      compact ? 'px-2 py-1.5' : 'px-3 py-2.5'
    } ${value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'} ${
      disabled ? 'opacity-60 pointer-events-none' : ''
    }`}
  >
    <Icon name="ScanFace" size={compact ? 14 : 18} className={value ? 'text-primary' : 'text-muted-foreground'} />
    <div className="flex-1 min-w-0">
      <p className={`${compact ? 'text-[11px]' : 'text-xs'} font-medium`}>Убрать второй подбородок</p>
      {!compact && (
        <p className="text-[11px] text-muted-foreground">
          Подтянет складку под челюстью и выровняет линию подбородка к шее. Остальное лицо не меняется
        </p>
      )}
    </div>
    <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
  </label>
);

export default ChinToggle;
