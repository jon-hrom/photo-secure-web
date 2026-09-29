import { useCallback, useEffect, useRef } from 'react';
import { CanvasState } from '@/components/tools/logoRemover/useCanvasState';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 10;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const useBrushInteractions = (s: CanvasState) => {
  const {
    brushSize, tool,
    zoom, pan, setZoom, setPan,
    maskCanvasRef, viewportRef,
    drawingRef, lastPointRef, pointersRef, pinchRef, panRef,
    setHasMask, bumpMask,
  } = s;

  /** Точка относительно центра области просмотра (от него считается transform). */
  const fromCenter = useCallback((clientX: number, clientY: number) => {
    const vp = viewportRef.current;
    if (!vp) return { x: 0, y: 0 };
    const r = vp.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  }, [viewportRef]);

  // Актуальные масштаб/сдвиг: колесо крутится быстрее, чем React успевает перерисовать.
  const viewRef = useRef({ zoom, pan });
  viewRef.current = { zoom, pan };

  /** Масштаб к точке: то, что под курсором/пальцами, остаётся на месте. */
  const zoomAt = useCallback((factor: number, clientX: number, clientY: number) => {
    const p = fromCenter(clientX, clientY);
    const { zoom: z, pan: old } = viewRef.current;
    const nz = clampZoom(z * factor);
    const k = nz / z;
    const np = nz <= MIN_ZOOM ? { x: 0, y: 0 } : { x: p.x - (p.x - old.x) * k, y: p.y - (p.y - old.y) * k };
    viewRef.current = { zoom: nz, pan: np };
    setZoom(() => nz);
    setPan(np);
  }, [fromCenter, setZoom, setPan]);

  // Колесо: обычное — масштаб к курсору. Вешаем вручную, иначе браузер
  // не даёт отменить прокрутку/масштаб страницы (React-обработчик пассивный).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      zoomAt(f, e.clientX, e.clientY);
    };
    // iOS Safari: жест масштаба двумя пальцами иначе увеличивает всю страницу
    const stop = (e: Event) => e.preventDefault();
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('gesturestart', stop);
    vp.addEventListener('gesturechange', stop);
    return () => {
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', stop);
      vp.removeEventListener('gesturechange', stop);
    };
  });

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawAt = (x: number, y: number, erase: boolean) => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d')!;
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.fillStyle = 'rgba(236, 72, 153, 0.55)';
    // Размер кисти — в экранных пикселях: при приближении она становится
    // тоньше относительно фото, и маску можно вести точно по контуру.
    const rect = mask.getBoundingClientRect();
    const scale = rect.width ? mask.width / rect.width : 1;
    const r = Math.max(1, brushSize * scale);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (lastPointRef.current) {
      ctx.lineWidth = r * 2;
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastPointRef.current = { x, y };
    if (!erase) setHasMask(true);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.target as HTMLCanvasElement;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      // Второй палец: это масштаб, а не рисование. Мазок первого пальца
      // (обычно короткий, до касания вторым) оставляем — он уже нарисован.
      if (drawingRef.current) bumpMask();
      drawingRef.current = false;
      lastPointRef.current = null;
      panRef.current = null;
      const pts = Array.from(pointersRef.current.values());
      const c = fromCenter((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      pinchRef.current = {
        dist: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
        zoom,
        centerX: c.x,
        centerY: c.y,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }
    if (pointersRef.current.size > 2) return;

    // Режим «Двигать» или средняя кнопка мыши — таскаем кадр.
    if (tool === 'pan' || e.button === 1) {
      drawingRef.current = false;
      lastPointRef.current = null;
      panRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    drawingRef.current = true;
    lastPointRef.current = null;
    const p = getCanvasPoint(e);
    drawAt(p.x, p.y, e.button === 2 || e.ctrlKey);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const pinch = pinchRef.current;
    if (pointersRef.current.size >= 2 && pinch) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const nz = clampZoom(pinch.zoom * (dist / pinch.dist));
      const c = fromCenter((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      const k = nz / pinch.zoom;
      // Точка фото, бывшая между пальцами, едет вместе с пальцами.
      setZoom(() => nz);
      setPan(nz <= MIN_ZOOM ? { x: 0, y: 0 } : {
        x: c.x - (pinch.centerX - pinch.panX) * k,
        y: c.y - (pinch.centerY - pinch.panY) * k,
      });
      return;
    }

    if (panRef.current && pointersRef.current.size === 1) {
      setPan({
        x: panRef.current.panX + (e.clientX - panRef.current.startX),
        y: panRef.current.panY + (e.clientY - panRef.current.startY),
      });
      return;
    }

    if (!drawingRef.current) return;
    const p = getCanvasPoint(e);
    drawAt(p.x, p.y, (e.buttons & 2) === 2 || e.ctrlKey);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;
    if (drawingRef.current) bumpMask();
    drawingRef.current = false;
    lastPointRef.current = null;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  /** Кнопки +/− масштабируют к центру видимой области. */
  const zoomBy = (factor: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
  };

  /** Совместимость: колесо уже обрабатывается нативно в эффекте выше. */
  const onWheel = () => undefined;

  return { onPointerDown, onPointerMove, onPointerUp, onWheel, zoomBy, zoomAt };
};