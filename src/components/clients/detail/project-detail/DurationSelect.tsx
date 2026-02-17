import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DurationSelectProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
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
        <SelectItem value="5">5 минут</SelectItem>
        <SelectItem value="10">10 минут</SelectItem>
        <SelectItem value="15">15 минут</SelectItem>
        <SelectItem value="20">20 минут</SelectItem>
        <SelectItem value="25">25 минут</SelectItem>
        <SelectItem value="30">30 минут</SelectItem>
        <SelectItem value="35">35 минут</SelectItem>
        <SelectItem value="40">40 минут</SelectItem>
        <SelectItem value="45">45 минут</SelectItem>
        <SelectItem value="50">50 минут</SelectItem>
        <SelectItem value="55">55 минут</SelectItem>
        <SelectItem value="60">1 час</SelectItem>
        <SelectItem value="90">1.5 часа</SelectItem>
        <SelectItem value="120">2 часа</SelectItem>
        <SelectItem value="150">2.5 часа</SelectItem>
        <SelectItem value="180">3 часа</SelectItem>
        <SelectItem value="240">4 часа</SelectItem>
        <SelectItem value="300">5 часов</SelectItem>
        <SelectItem value="360">6 часов</SelectItem>
        <SelectItem value="420">7 часов</SelectItem>
        <SelectItem value="480">8 часов</SelectItem>
        <SelectItem value="540">9 часов</SelectItem>
        <SelectItem value="600">10 часов</SelectItem>
        <SelectItem value="660">11 часов</SelectItem>
        <SelectItem value="720">12 часов</SelectItem>
        <SelectItem value="780">13 часов</SelectItem>
        <SelectItem value="840">14 часов</SelectItem>
        <SelectItem value="900">15 часов</SelectItem>
        <SelectItem value="960">16 часов</SelectItem>
        <SelectItem value="1020">17 часов</SelectItem>
        <SelectItem value="1080">18 часов</SelectItem>
        <SelectItem value="1140">19 часов</SelectItem>
        <SelectItem value="1200">20 часов</SelectItem>
        <SelectItem value="1260">21 час</SelectItem>
        <SelectItem value="1320">22 часа</SelectItem>
        <SelectItem value="1380">23 часа</SelectItem>
        <SelectItem value="1440">24 часа</SelectItem>
      </SelectContent>
    </Select>
  );
};

export default DurationSelect;
