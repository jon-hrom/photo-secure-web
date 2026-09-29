import { RefObject, useEffect, useRef } from 'react';

interface BrushCursorProps {
  containerRef: RefObject<HTMLElement>;
  /** Диаметр кисти в экранных пикселях */
  diameter: number;
  enabled?: boolean;
}

/**
 * Круглый курсор кисти, повторяющий её реальный размер.
 *
 * Кружок двигается напрямую через transform — без перерисовки React
 * и без пересчёта раскладки страницы на каждое движение мыши,
 * поэтому он успевает за курсором так же, как системный.
 */
const BrushCursor = ({ containerRef, diameter, enabled = true }: BrushCursorProps) => {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef(Math.max(2, diameter));
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const previewTimer = useRef<number | null>(null);
  const firstRender = useRef(true);

  const place = (x: number, y: number, preview = false) => {
    const el = ringRef.current;
    if (!el) return;
    const d = sizeRef.current;
    el.style.transform = `translate3d(${x - d / 2}px, ${y - d / 2}px, 0)`;
    el.style.background = preview ? 'rgba(236,72,153,0.25)' : 'transparent';
    el.style.opacity = '1';
  };

  const hideRing = () => {
    if (ringRef.current) ringRef.current.style.opacity = '0';
  };

  useEffect(() => {
    const host = containerRef.current;
    if (!host || !enabled) {
      hideRing();
      return;
    }

    // Позицию области кешируем: getBoundingClientRect на каждое движение
    // заставляет браузер пересчитывать раскладку и даёт то самое подтормаживание.
    let rect = host.getBoundingClientRect();
    const refreshRect = () => { rect = host.getBoundingClientRect(); };
    let raf = 0;
    let pending: { x: number; y: number } | null = null;
    const flush = () => {
      raf = 0;
      if (pending) place(pending.x, pending.y);
    };

    const touches = new Set<number>();
    const update = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        if (e.type === 'pointerdown') touches.add(e.pointerId);
        // Два пальца — это масштаб, а не кисть: кружок не показываем
        if (touches.size > 1) {
          posRef.current = null;
          hideRing();
          return;
        }
        if (e.type === 'pointermove' && !touches.has(e.pointerId)) return;
      }
      if (e.type === 'pointerdown') refreshRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      posRef.current = p;
      pending = p;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const onEnter = () => refreshRect();
    const hide = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      posRef.current = null;
      pending = null;
      hideRing();
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (e.pointerType !== 'mouse') {
        posRef.current = null;
        hideRing();
      }
    };

    // capture: иначе setPointerCapture у canvas перехватывает события раньше нас
    const opt = { capture: true, passive: true } as AddEventListenerOptions;
    host.addEventListener('pointerenter', onEnter, opt);
    host.addEventListener('pointermove', update, opt);
    host.addEventListener('pointerdown', update, opt);
    host.addEventListener('pointerleave', hide, opt);
    host.addEventListener('pointerup', onUp, opt);
    host.addEventListener('pointercancel', hide, opt);
    window.addEventListener('scroll', refreshRect, { capture: true, passive: true });
    window.addEventListener('resize', refreshRect);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refreshRect) : null;
    ro?.observe(host);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      host.removeEventListener('pointerenter', onEnter, opt);
      host.removeEventListener('pointermove', update, opt);
      host.removeEventListener('pointerdown', update, opt);
      host.removeEventListener('pointerleave', hide, opt);
      host.removeEventListener('pointerup', onUp, opt);
      host.removeEventListener('pointercancel', hide, opt);
      window.removeEventListener('scroll', refreshRect, { capture: true });
      window.removeEventListener('resize', refreshRect);
      ro?.disconnect();
    };
  }, [containerRef, enabled]);

  // Смена размера ползунком: меняем размер сразу, а если курсор не над фото —
  // на секунду показываем кружок в центре, чтобы был виден новый размер.
  useEffect(() => {
    const d = Math.max(2, diameter);
    sizeRef.current = d;
    const el = ringRef.current;
    if (el) {
      el.style.width = `${d}px`;
      el.style.height = `${d}px`;
    }
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!enabled) return;
    const p = posRef.current;
    if (p) {
      place(p.x, p.y);
      return;
    }
    const host = containerRef.current;
    if (!host) return;
    place(host.clientWidth / 2, host.clientHeight / 2, true);
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      if (!posRef.current) hideRing();
    }, 900);
  }, [diameter, enabled, containerRef]);

  useEffect(() => () => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
  }, []);

  if (!enabled) return null;

  const d = Math.max(2, diameter);
  return (
    <div
      ref={ringRef}
      className="pointer-events-none absolute left-0 top-0 z-30 rounded-full will-change-transform"
      style={{
        width: d,
        height: d,
        opacity: 0,
        border: '1.5px solid rgba(255,255,255,0.95)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.6)',
        contain: 'strict',
      }}
    />
  );
};

export default BrushCursor;
