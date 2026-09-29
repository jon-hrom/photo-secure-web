import { RefObject, useEffect, useRef, useState } from 'react';

interface BrushCursorProps {
  containerRef: RefObject<HTMLElement>;
  /** Диаметр кисти в экранных пикселях */
  diameter: number;
  enabled?: boolean;
}

/**
 * Круглый курсор кисти, повторяющий её реальный размер.
 * При изменении размера (ползунком) кружок на секунду показывается
 * в центре области, чтобы сразу было видно новый размер.
 */
const BrushCursor = ({ containerRef, diameter, enabled = true }: BrushCursorProps) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState(false);
  const firstRender = useRef(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) {
      setPos(null);
      return;
    }
    const touches = new Set<number>();
    const update = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        if (e.type === 'pointerdown') touches.add(e.pointerId);
        // Два пальца — это масштаб, а не кисть: кружок не показываем
        if (touches.size > 1) {
          setPos(null);
          return;
        }
        // Палец без касания (Android-стилус «над экраном») не рисует
        if (e.type === 'pointermove' && !touches.has(e.pointerId)) return;
      }
      const rect = el.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const hide = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      setPos(null);
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (e.pointerType !== 'mouse') setPos(null);
    };
    // capture: иначе setPointerCapture у canvas перехватывает события раньше нас
    const opt = { capture: true, passive: true } as AddEventListenerOptions;
    el.addEventListener('pointermove', update, opt);
    el.addEventListener('pointerdown', update, opt);
    el.addEventListener('pointerleave', hide, opt);
    el.addEventListener('pointerup', onUp, opt);
    el.addEventListener('pointercancel', hide, opt);
    return () => {
      el.removeEventListener('pointermove', update, opt);
      el.removeEventListener('pointerdown', update, opt);
      el.removeEventListener('pointerleave', hide, opt);
      el.removeEventListener('pointerup', onUp, opt);
      el.removeEventListener('pointercancel', hide, opt);
    };
  }, [containerRef, enabled]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPreview(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setPreview(false), 900);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [diameter]);

  if (!enabled) return null;

  const el = containerRef.current;
  let point = pos;
  if (!point && preview && el) {
    point = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
  }
  if (!point) return null;

  const d = Math.max(2, diameter);

  return (
    <div
      className="pointer-events-none absolute z-30 rounded-full"
      style={{
        left: point.x - d / 2,
        top: point.y - d / 2,
        width: d,
        height: d,
        border: '1.5px solid rgba(255,255,255,0.95)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.6)',
        background: pos ? 'transparent' : 'rgba(236,72,153,0.25)',
      }}
    />
  );
};

export default BrushCursor;
