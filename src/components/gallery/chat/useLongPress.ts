import { useCallback, useRef } from 'react';

interface Options {
  delay?: number;
  moveThreshold?: number;
}

export function useLongPress(
  onTrigger: (pos: { x: number; y: number }) => void,
  options: Options = {}
) {
  const { delay = 450, moveThreshold = 10 } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY };
      firedRef.current = false;
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        if (navigator.vibrate) {
          try { navigator.vibrate(20); } catch { /* noop */ }
        }
        onTrigger({ x: t.clientX, y: t.clientY });
      }, delay);
    },
    [delay, onTrigger]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startRef.current) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startRef.current.x);
      const dy = Math.abs(t.clientY - startRef.current.y);
      if (dx > moveThreshold || dy > moveThreshold) clear();
    },
    [clear, moveThreshold]
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onTrigger({ x: e.clientX, y: e.clientY });
    },
    [onTrigger]
  );

  return {
    longPressHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd, onContextMenu },
    wasLongPress: () => firedRef.current,
  };
}
