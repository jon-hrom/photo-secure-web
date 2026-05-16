import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';

interface ThemeToggleButtonProps {
  isDarkBg: boolean;
  onToggle?: () => void;
}

export default function ThemeToggleButton({ isDarkBg, onToggle }: ThemeToggleButtonProps) {
  const lastFireRef = useRef(0);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('gallery-theme-hint-seen');
      if (!seen) {
        const t1 = setTimeout(() => setShowHint(true), 1200);
        const t2 = setTimeout(() => {
          setShowHint(false);
          try { localStorage.setItem('gallery-theme-hint-seen', '1'); } catch { /* noop */ }
        }, 7000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    } catch { /* noop */ }
  }, []);

  const dismissHint = () => {
    if (!showHint) return;
    setShowHint(false);
    try { localStorage.setItem('gallery-theme-hint-seen', '1'); } catch { /* noop */ }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastFireRef.current < 400) return;
    lastFireRef.current = now;
    dismissHint();
    onToggle?.();
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer select-none"
        style={{
          width: 40,
          height: 40,
          minWidth: 40,
          minHeight: 40,
          background: isDarkBg ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          border: isDarkBg ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.08)',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          touchAction: 'manipulation',
          animation: showHint ? 'themeHintPulse 1.6s ease-in-out infinite' : undefined,
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

      {showHint && (
        <div
          onClick={dismissHint}
          className="absolute left-0 top-full mt-2 z-50 flex items-start gap-2 rounded-xl shadow-2xl cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#ffffff',
            padding: '10px 12px',
            fontSize: 12,
            lineHeight: 1.3,
            minWidth: 200,
            maxWidth: 260,
            animation: 'themeHintIn 0.35s ease-out',
          }}
        >
          <div
            className="absolute"
            style={{
              top: -6,
              left: 14,
              width: 12,
              height: 12,
              background: '#6366f1',
              transform: 'rotate(45deg)',
            }}
          />
          <Icon name="Sparkles" size={16} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold mb-0.5">Можно переключить тему</p>
            <p style={{ opacity: 0.9, fontSize: 11 }}>Нажмите, чтобы сделать светлее или темнее</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); dismissHint(); }}
            className="flex-shrink-0 opacity-80 active:opacity-100"
            aria-label="Закрыть подсказку"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes themeHintPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.55); }
          50% { box-shadow: 0 0 0 10px rgba(139, 92, 246, 0); }
        }
        @keyframes themeHintIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
