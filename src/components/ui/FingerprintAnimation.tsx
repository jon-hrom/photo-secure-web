import Icon from '@/components/ui/icon';

export type AnimationState = 'idle' | 'scanning' | 'success' | 'error';

interface FingerprintAnimationProps {
  state: AnimationState;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { container: 'w-16 h-16', circle: 'w-12 h-12', svg: 24, badge: 'w-5 h-5', badgeIcon: 10 },
  md: { container: 'w-28 h-28', circle: 'w-20 h-20', svg: 44, badge: 'w-7 h-7', badgeIcon: 14 },
  lg: { container: 'w-36 h-36', circle: 'w-28 h-28', svg: 56, badge: 'w-8 h-8', badgeIcon: 16 },
};

const FingerprintAnimation = ({ state, size = 'md' }: FingerprintAnimationProps) => {
  const s = sizeMap[size];
  const baseColor = state === 'success' ? '#22c55e' : state === 'error' ? '#ef4444' : state === 'scanning' ? '#3b82f6' : '#94a3b8';
  const pulseColor = state === 'scanning' ? 'rgba(59, 130, 246, 0.3)' : state === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'transparent';

  return (
    <>
      <style>{`
        @keyframes fp-scan-line {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes fp-scale-in {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes fp-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .fp-scan-line { animation: fp-scan-line 1.5s ease-in-out infinite; }
        .fp-scale-in { animation: fp-scale-in 0.3s ease-out; }
        .fp-glow { animation: fp-glow 1.5s ease-in-out infinite; }
      `}</style>

      <div className={`relative flex items-center justify-center ${s.container} mx-auto`}>
        {state === 'scanning' && (
          <>
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ backgroundColor: pulseColor, animationDuration: '1.5s' }}
            />
            <div
              className="absolute inset-2 rounded-full animate-ping"
              style={{ backgroundColor: pulseColor, animationDuration: '2s', animationDelay: '0.3s' }}
            />
          </>
        )}

        {state === 'success' && (
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', animationDuration: '1s' }}
          />
        )}

        <div
          className={`relative z-10 ${s.circle} flex items-center justify-center rounded-full transition-all duration-500`}
          style={{
            background: `linear-gradient(135deg, ${baseColor}15, ${baseColor}30)`,
            border: `2px solid ${baseColor}`,
            boxShadow: state !== 'idle' ? `0 0 20px ${baseColor}40` : 'none',
          }}
        >
          <svg
            width={s.svg}
            height={s.svg}
            viewBox="0 0 24 24"
            fill="none"
            stroke={baseColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={state === 'scanning' ? 'fp-glow' : ''}
          >
            <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
            <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
            <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
            <path d="M2 12a10 10 0 0 1 18-6" />
            <path d="M2 16h.01" />
            <path d="M21.8 16c.2-2 .131-5.354 0-6" />
            <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
            <path d="M8.65 22c.21-.66.45-1.32.57-2" />
            <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
          </svg>

          {state === 'scanning' && (
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div
                className="w-full h-1 bg-blue-400/60 absolute fp-scan-line"
                style={{ boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)' }}
              />
            </div>
          )}

          {state === 'success' && (
            <div className={`absolute -bottom-1 -right-1 ${s.badge} bg-green-500 rounded-full flex items-center justify-center shadow-lg fp-scale-in`}>
              <Icon name="Check" size={s.badgeIcon} className="text-white" />
            </div>
          )}

          {state === 'error' && (
            <div className={`absolute -bottom-1 -right-1 ${s.badge} bg-red-500 rounded-full flex items-center justify-center shadow-lg fp-scale-in`}>
              <Icon name="X" size={s.badgeIcon} className="text-white" />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FingerprintAnimation;
