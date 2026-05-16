import { useRef } from 'react';
import Icon from '@/components/ui/icon';

interface ThemeToggleButtonProps {
  isDarkBg: boolean;
  onToggle?: () => void;
}

export default function ThemeToggleButton({ isDarkBg, onToggle }: ThemeToggleButtonProps) {
  const lastFireRef = useRef(0);

  const fire = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastFireRef.current < 400) return;
    lastFireRef.current = now;
    onToggle?.();
  };

  return (
    <button
      type="button"
      onPointerUp={fire}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className="flex items-center justify-center rounded-full transition-all active:scale-90 touch-manipulation flex-shrink-0 cursor-pointer select-none"
      style={{
        width: 40,
        height: 40,
        minWidth: 40,
        minHeight: 40,
        background: isDarkBg ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        border: isDarkBg ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.08)',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
      aria-label={isDarkBg ? 'Светлая тема' : 'Тёмная тема'}
      title={isDarkBg ? 'Включить светлую тему' : 'Включить тёмную тему'}
    >
      {isDarkBg ? (
        <Icon name="Sun" size={20} className="text-yellow-400" />
      ) : (
        <Icon name="Moon" size={20} className="text-blue-600" />
      )}
    </button>
  );
}
