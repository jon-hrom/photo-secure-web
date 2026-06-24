import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DurationSelectProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

const formatHours = (minutes: number) => {
  const hours = minutes / 60;
  const rounded = Number.isInteger(hours) ? hours : hours.toFixed(1);
  const lastDigit = Math.floor(hours) % 10;
  const lastTwo = Math.floor(hours) % 100;
  let word = 'часов';
  if (!Number.isInteger(hours)) {
    word = 'часа';
  } else if (lastTwo < 11 || lastTwo > 14) {
    if (lastDigit === 1) word = 'час';
    else if (lastDigit >= 2 && lastDigit <= 4) word = 'часа';
  }
  return `${rounded} ${word}`;
};

const subHourOptions = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const hourOptions: number[] = [];
for (let m = 60; m <= 1440; m += 30) {
  hourOptions.push(m);
}

const DurationSelect = ({ value, onChange, className }: DurationSelectProps) => {
  return (
    <Select
      value={String(value || 120)}
      onValueChange={(v) => onChange(parseInt(v))}
    >
      <SelectTrigger className={className || "text-xs h-9"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {subHourOptions.map((m) => (
          <SelectItem key={m} value={String(m)}>{m} минут</SelectItem>
        ))}
        {hourOptions.map((m) => (
          <SelectItem key={m} value={String(m)}>{formatHours(m)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default DurationSelect;
