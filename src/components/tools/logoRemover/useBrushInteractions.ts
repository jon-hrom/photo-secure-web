import { CanvasState } from '@/components/tools/logoRemover/useCanvasState';

export const useBrushInteractions = (s: CanvasState) => {
  const {
    brushSize,
    zoom, pan, setZoom, setPan,
    maskCanvasRef,
    drawingRef, lastPointRef, pointersRef, pinchRef,
    setHasMask,
  } = s;

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
    const rect = mask.getBoundingClientRect();
    const scale = rect.width ? mask.width / rect.width : 1;
    const r = Math.max(4, brushSize * scale);
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
    canvas.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      drawingRef.current = false;
      lastPointRef.current = null;
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchRef.current = {
        dist: Math.hypot(dx, dy),
        zoom,
        centerX: (pts[0].x + pts[1].x) / 2,
        centerY: (pts[0].y + pts[1].y) / 2,
        panX: pan.x,
        panY: pan.y,
      };
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

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const newZoom = Math.min(6, Math.max(1, pinchRef.current.zoom * (dist / pinchRef.current.dist)));
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      setZoom(newZoom);
      setPan({
        x: pinchRef.current.panX + (cx - pinchRef.current.centerX),
        y: pinchRef.current.panY + (cy - pinchRef.current.centerY),
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
    drawingRef.current = false;
    lastPointRef.current = null;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(6, Math.max(1, z * delta)));
  };

  return { onPointerDown, onPointerMove, onPointerUp, onWheel };
};
