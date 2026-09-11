import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

const SUGGEST_API = 'https://functions.poehali.dev/82f27947-3bba-455c-a72f-2c0fd499e147';

interface Suggestion {
  title: string;
  subtitle: string;
  value: string;
  is_place: boolean;
}

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** Город для уточнения поиска. По умолчанию — город фотографа из настроек */
  city?: string;
  disabled?: boolean;
}

/**
 * Поле адреса с подсказками: ищет улицы, дома, а также ТЦ,
 * студии и кафе по названию — «Аэрохолл» подставится вместе с адресом.
 */
const AddressInput = ({
  value,
  onChange,
  placeholder = 'Начните вводить адрес или название места',
  className,
  id,
  city,
  disabled,
}: AddressInputProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const skipNextFetch = useRef(false);
  const requestId = useRef(0);

  const searchCity = city ?? localStorage.getItem('user_city') ?? '';

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const currentRequest = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ query });
        if (searchCity) params.set('city', searchCity);

        const res = await fetch(`${SUGGEST_API}?${params.toString()}`);
        const data = await res.json();

        // Игнорируем ответ, если пользователь успел напечатать дальше
        if (currentRequest !== requestId.current) return;

        if (data.error === 'NO_API_KEY' || data.error === 'BAD_API_KEY') {
          setUnavailable(true);
          setSuggestions([]);
          setIsOpen(false);
          return;
        }

        setUnavailable(false);
        setSuggestions(data.suggestions || []);
        setActiveIndex(-1);
        setIsOpen((data.suggestions || []).length > 0);
      } catch {
        if (currentRequest === requestId.current) {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [value, searchCity]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const pick = (suggestion: Suggestion) => {
    skipNextFetch.current = true;
    onChange(suggestion.value);
    setIsOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cn('pr-8', className)}
          disabled={disabled}
          autoComplete="off"
        />
        {loading && (
          <Icon
            name="Loader2"
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={`${s.value}-${i}`}
                type="button"
                onClick={() => pick(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'w-full text-left px-3 py-2 flex items-start gap-2 transition-colors',
                  i === activeIndex ? 'bg-accent' : 'hover:bg-accent/60'
                )}
              >
                <Icon
                  name={s.is_place ? 'Building2' : 'MapPin'}
                  size={14}
                  className={cn(
                    'mt-0.5 shrink-0',
                    s.is_place ? 'text-violet-500' : 'text-muted-foreground'
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium truncate">{s.title}</span>
                  {s.subtitle && (
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {s.subtitle}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {unavailable && value.trim().length >= 3 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Подсказки адресов недоступны — адрес можно ввести вручную
        </p>
      )}
    </div>
  );
};

export default AddressInput;
