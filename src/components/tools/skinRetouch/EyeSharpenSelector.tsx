import Icon from '@/components/ui/icon';
import { EYE_SHARPEN_OPTIONS, EyeSharpenKey } from '@/components/tools/skinRetouch/utils';

interface EyeSharpenSelectorProps {
  value: EyeSharpenKey;
  onChange: (v: EyeSharpenKey) => void;
  disabled?: boolean;
}

const EyeSharpenSelector = ({ value, onChange, disabled }: EyeSharpenSelectorProps) => (
  <div>
    <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
      <Icon name="Eye" size={14} />
      Резкость глаз
    </p>
    <div className="grid grid-cols-3 gap-2">
      {EYE_SHARPEN_OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.key)}
          className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-60 ${
            value === o.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

export default EyeSharpenSelector;
