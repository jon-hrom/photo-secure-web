import { useEffect, useState } from 'react';

export interface SnowSettings {
  enabled: boolean;
  speed: number;
  size: number;
  direction: 'down' | 'left' | 'right' | 'auto';
  colors: {
    white: number;
    blue: number;
    black: number;
    yellow: number;
    red: number;
    green: number;
  };
}

const DEFAULT_SETTINGS: SnowSettings = {
  enabled: true,
  speed: 1,
  size: 20,
  direction: 'auto',
  colors: {
    white: 70,
    blue: 15,
    black: 0,
    yellow: 10,
    red: 3,
    green: 2,
  }
};

const NewYearDecorations = () => {
  const [showSnow, setShowSnow] = useState(true);
  const [settings, setSettings] = useState<SnowSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const timer = setTimeout(() => setShowSnow(true), 100);
    
    // Load settings from localStorage
    const saved = localStorage.getItem('newYearSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse snow settings:', e);
      }
    }
    
    // Listen for settings changes
    const handleSettingsChange = () => {
      const saved = localStorage.getItem('newYearSettings');
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse snow settings:', e);
        }
      }
    };
    
    window.addEventListener('newYearSettingsChange', handleSettingsChange);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('newYearSettingsChange', handleSettingsChange);
    };
  }, []);

  if (!settings.enabled || !showSnow) return null;

  // Generate snowflakes with color distribution
  const getSnowflakeColor = (index: number): string => {
    const colors = settings.colors;
    const total = colors.white + colors.blue + colors.black + colors.yellow + colors.red + colors.green;
    const random = (index * 17) % total; // Pseudo-random based on index
    
    let cumulative = 0;
    if (random < (cumulative += colors.white)) return '#ffffff';
    if (random < (cumulative += colors.blue)) return '#3b82f6';
    if (random < (cumulative += colors.yellow)) return '#facc15';
    if (random < (cumulative += colors.red)) return '#ef4444';
    if (random < (cumulative += colors.green)) return '#22c55e';
    return '#000000'; // black
  };

  // Calculate animation based on direction and speed
  const getAnimationName = (index: number): string => {
    if (settings.direction === 'auto') {
      const directions = ['fall-down', 'fall-left', 'fall-right'];
      return directions[index % directions.length];
    }
    return settings.direction === 'down' ? 'fall-down' : 
           settings.direction === 'left' ? 'fall-left' : 'fall-right';
  };

  const baseSpeed = 8; // base duration in seconds
  const duration = baseSpeed / settings.speed;

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="snowflake absolute opacity-70"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              fontSize: `${settings.size}px`,
              animation: `${getAnimationName(i)} ${duration + Math.random() * 3}s linear infinite`,
              color: getSnowflakeColor(i),
              textShadow: `0 0 5px ${getSnowflakeColor(i)}`,
            }}
          >
            ❄
          </div>
        ))}
      </div>

      <div className="fixed top-0 left-0 right-0 pointer-events-none z-50">
        <svg className="w-full h-32" viewBox="0 0 1000 150" preserveAspectRatio="none">
          <path
            d="M0,50 Q50,20 100,50 T200,50 T300,50 T400,50 T500,50 T600,50 T700,50 T800,50 T900,50 T1000,50 L1000,0 L0,0 Z"
            fill="rgba(139, 69, 19, 0.8)"
          />
        </svg>
        
        <div className="absolute top-0 left-0 right-0 flex justify-around items-start px-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="bulb"
              style={{
                position: 'absolute',
                left: `${(i * 5) + 2.5}%`,
                top: `${15 + Math.sin(i * 0.5) * 10}px`,
                animation: `twinkle ${Math.random() * 2 + 1}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`
              }}
            >
              <div className={`w-3 h-4 rounded-full shadow-lg bulb-color-${i % 5}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="fixed top-12 left-1/2 -translate-x-1/2 pointer-events-none z-50">
        <div className="text-6xl animate-pulse">
          🎄
        </div>
      </div>

      <style>{`
        @keyframes fall-down {
          0% {
            transform: translateY(-10vh) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.7;
          }
          90% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(100vh) translateX(0) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes fall-left {
          0% {
            transform: translateY(-10vh) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.7;
          }
          90% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(100vh) translateX(-30vw) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes fall-right {
          0% {
            transform: translateY(-10vh) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.7;
          }
          90% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(100vh) translateX(30vw) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(0.8);
          }
        }

        .bulb-color-0 {
          background: linear-gradient(135deg, #ff6b6b, #ff8787);
          box-shadow: 0 0 10px #ff6b6b;
        }
        .bulb-color-1 {
          background: linear-gradient(135deg, #4ecdc4, #6ee7de);
          box-shadow: 0 0 10px #4ecdc4;
        }
        .bulb-color-2 {
          background: linear-gradient(135deg, #ffe66d, #fff59d);
          box-shadow: 0 0 10px #ffe66d;
        }
        .bulb-color-3 {
          background: linear-gradient(135deg, #a8e6cf, #c4f0e0);
          box-shadow: 0 0 10px #a8e6cf;
        }
        .bulb-color-4 {
          background: linear-gradient(135deg, #c77dff, #e0aaff);
          box-shadow: 0 0 10px #c77dff;
        }

        .snowflake {
          text-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
        }
      `}</style>
    </>
  );
};

export default NewYearDecorations;