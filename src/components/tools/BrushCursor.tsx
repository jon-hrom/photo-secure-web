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
    const update = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const hide = () => setPos(null);
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') setPos(null);
    };
    el.addEventListener('pointermove', update);
    el.addEventListener('pointerdown', update);
    el.addEventListener('pointerleave', hide);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', hide);
    return () => {
      el.removeEventListener('pointermove', update);
      el.removeEventListener('pointerdown', update);
      el.removeEventListener('pointerleave', hide);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', hide);
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
