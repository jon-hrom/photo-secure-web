export const triggerHapticFeedback = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof window === 'undefined') return;

  try {
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 30
      };
      navigator.vibrate(patterns[style]);
    }

    if ((window as any).Telegram?.WebApp?.HapticFeedback) {
      const telegram = (window as any).Telegram.WebApp.HapticFeedback;
      
      if (style === 'light') {
        telegram.impactOccurred('light');
      } else if (style === 'medium') {
        telegram.impactOccurred('medium');
      } else {
        telegram.impactOccurred('heavy');
      }
    }
  } catch (error) {
    console.debug('[HAPTICS] Vibration not supported:', error);
  }
};

export const triggerSelectionHaptic = () => {
  try {
    if ((window as any).Telegram?.WebApp?.HapticFeedback) {
      (window as any).Telegram.WebApp.HapticFeedback.selectionChanged();
    } else if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  } catch (error) {
    console.debug('[HAPTICS] Selection haptic not supported:', error);
  }
};
