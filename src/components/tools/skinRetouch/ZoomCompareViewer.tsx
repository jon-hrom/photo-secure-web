import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  originalUrl: string;
  resultUrl: string;
}

type Mode = 'split' | 'before' | 'after';

const MAX_ZOOM = 12;

/**
 * Полноэкранный просмотр «до/после» с приближением до 1:1 и дальше.
 * Колесо / щипок — зум к точке, перетаскивание — панорама,
 * шторка двигается за ручку, двойной клик — 100% ↔ вписать.
 */
const ZoomCompareViewer = ({ open, onOpenChange, originalUrl, resultUrl }: Props) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [fit, setFit] = useState(1);
  const [split, setSplit] = useState(50);
  const [mode, setMode] = useState<Mode>('split');
  const [holdBefore, setHoldBefore] = useState(false);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: 'pan' | 'pinch' | 'split' | null; dist?: number; lastX?: number; lastY?: number }>({ kind: null });

  const clampView = useCallback(
    (v: { scale: number; x: number; y: number }) => {
      const st = stageRef.current;
      if (!st || !nat.w) return v;
      const sw = st.clientWidth;
      const sh = st.clientHeight;
      const iw = nat.w * v.scale;
      const ih = nat.h * v.scale;
      const x = iw <= sw ? (sw - iw) / 2 : Math.min(0, Math.max(sw - iw, v.x));
      const y = ih <= sh ? (sh - ih) / 2 : Math.min(0, Math.max(sh - ih, v.y));
      return { scale: v.scale, x, y };
    },
    [nat],
  );

  const fitToScreen = useCallback(() => {
    const st = stageRef.current;
    if (!st || !nat.w) return;
    const f = Math.min(st.clientWidth / nat.w, st.clientHeight / nat.h, 1);
    setFit(f);
    setView(clampView({ scale: f, x: 0, y: 0 }));
  }, [nat, clampView]);

  useEffect(() => {
    if (!open) return;
    setMode('split');
    setSplit(50);
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = resultUrl;
  }, [open, resultUrl]);

  useEffect(() => {
    if (!open || !nat.w) return;
    const t = setTimeout(fitToScreen, 30);
    const onResize = () => fitToScreen();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [open, nat, fitToScreen]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      setView((v) => {
        const minS = Math.min(fit, 1);
        const scale = Math.min(MAX_ZOOM, Math.max(minS, v.scale * factor));
        const k = scale / v.scale;
        return clampView({ scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
      });
    },
    [fit, clampView],
  );

  const zoomCenter = (factor: number) => {
    const st = stageRef.current;
    if (!st) return;
    zoomAt(factor, st.clientWidth / 2, st.clientHeight / 2);
  };

  const setScaleCenter = (scale: number) => {
    const st = stageRef.current;
    if (!st) return;
    setView((v) => {
      const cx = st.clientWidth / 2;
      const cy = st.clientHeight / 2;
      const k = scale / v.scale;
      return clampView({ scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
    });
  };

  // Колесо вешаем вручную: React-обработчик пассивный и не даёт preventDefault.
  useEffect(() => {
    const st = stageRef.current;
    if (!open || !st) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = st.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
    };
    st.addEventListener('wheel', onWheel, { passive: false });
    return () => st.removeEventListener('wheel', onWheel);
  }, [open, zoomAt, nat]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Положение шторки в координатах экрана.
  const splitScreenX = view.x + (nat.w * view.scale * split) / 100;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) };
      return;
    }
    const nearHandle = mode === 'split' && Math.abs(p.x - splitScreenX) < 28;
    gesture.current = nearHandle ? { kind: 'split' } : { kind: 'pan', lastX: p.x, lastY: p.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.dist) zoomAt(d / g.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      g.dist = d;
    } else if (g.kind === 'split') {
      const pct = ((p.x - view.x) / (nat.w * view.scale)) * 100;
      setSplit(Math.max(0, Math.min(100, pct)));
    } else if (g.kind === 'pan') {
      const dx = p.x - (g.lastX ?? p.x);
      const dy = p.y - (g.lastY ?? p.y);
      g.lastX = p.x;
      g.lastY = p.y;
      setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      gesture.current = { kind: 'pan', lastX: p.x, lastY: p.y };
    } else if (pointers.current.size === 0) {
      gesture.current = { kind: null };
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const p = local(e);
    if (view.scale < 0.99) zoomAt(1 / view.scale, p.x, p.y);
    else fitToScreen();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') zoomCenter(1.25);
      else if (e.key === '-') zoomCenter(0.8);
      else if (e.key === '0') fitToScreen();
      else if (e.key === '1') setScaleCenter(1);
      else if (e.key === ' ') {
        e.preventDefault();
        setHoldBefore(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setHoldBefore(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fitToScreen]);

  const effMode: Mode = holdBefore ? 'before' : mode;
  const clip =
    effMode === 'before' ? 'none' : effMode === 'after' ? 'inset(0 100% 0 0)' : `inset(0 ${100 - split}% 0 0)`;
  const pct = Math.round(view.scale * 100);
  const imgStyle = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: nat.w,
    height: nat.h,
    maxWidth: 'none',
    imageRendering: (view.scale >= 2 ? 'pixelated' : 'auto') as 'pixelated' | 'auto',
  };

  const btn = 'h-9 min-w-9 px-2 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-colors';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="left-0 top-0 translate-x-0 translate-y-0 max-w-none w-screen h-[100dvh] p-0 gap-0 border-0 rounded-none sm:rounded-none bg-neutral-950 flex flex-col"
      >
        <DialogTitle className="sr-only">Сравнение до и после</DialogTitle>
        <DialogDescription className="sr-only">Приближение и сравнение результата ретуши</DialogDescription>

        <div className="flex items-center gap-1.5 px-2 sm:px-3 py-2 bg-neutral-900/95 text-white border-b border-white/10 flex-wrap">
          <div className="flex rounded-lg bg-white/10 p-0.5">
            {([
              ['before', 'До'],
              ['split', 'Шторка'],
              ['after', 'После'],
            ] as [Mode, string][]).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`${btn} ${mode === m ? 'bg-white text-black' : 'hover:bg-white/10'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 ml-auto">
            <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => zoomCenter(0.8)} title="Отдалить">
              <Icon name="ZoomOut" size={18} />
            </button>
            <span className="text-xs tabular-nums w-12 text-center">{pct}%</span>
            <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => zoomCenter(1.25)} title="Приблизить">
              <Icon name="ZoomIn" size={18} />
            </button>
            <button type="button" className={`${btn} hover:bg-white/10`} onClick={fitToScreen} title="Вписать в экран">
              <Icon name="Minimize2" size={16} />
            </button>
            <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => setScaleCenter(1)} title="100% — пиксель в пиксель">
              1:1
            </button>
            <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => setScaleCenter(2)}>
              200%
            </button>
            <button
              type="button"
              className={`${btn} bg-white/15 hover:bg-white/25 ml-1`}
              onClick={() => onOpenChange(false)}
              title="Закрыть"
            >
              <Icon name="X" size={18} />
            </button>
          </div>
        </div>

        <div
          ref={stageRef}
          className="relative flex-1 overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          {nat.w > 0 && (
            <div
              className="absolute left-0 top-0 origin-top-left will-change-transform"
              style={{ width: nat.w, height: nat.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            >
              <img src={resultUrl} alt="После" draggable={false} style={imgStyle} />
              <img src={originalUrl} alt="До" draggable={false} style={{ ...imgStyle, clipPath: clip }} />
            </div>
          )}

          {effMode === 'split' && nat.w > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)] pointer-events-none"
              style={{ left: splitScreenX }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-0 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
                <Icon name="ChevronsLeftRight" size={20} className="text-black" />
              </div>
            </div>
          )}

          <div className="absolute top-2 left-2 flex gap-1.5 pointer-events-none">
            {effMode !== 'after' && <span className="text-[11px] font-medium text-white bg-black/60 px-2 py-0.5 rounded">До</span>}
          </div>
          <div className="absolute top-2 right-2 pointer-events-none">
            {effMode !== 'before' && <span className="text-[11px] font-medium text-white bg-black/60 px-2 py-0.5 rounded">После</span>}
          </div>

          <button
            type="button"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 h-10 rounded-full bg-white/90 text-black text-xs font-medium shadow-lg flex items-center gap-1.5 active:bg-white"
            onPointerDown={(e) => {
              e.stopPropagation();
              setHoldBefore(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setHoldBefore(false);
            }}
            onPointerLeave={() => setHoldBefore(false)}
            onPointerCancel={() => setHoldBefore(false)}
          >
            <Icon name="Eye" size={16} />
            Держать — показать «До»
          </button>

          <p className="hidden sm:block absolute bottom-4 right-3 text-[10px] text-white/50 pointer-events-none">
            Колесо — зум · перетаскивание — сдвиг · двойной клик — 100% · пробел — «До»
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ZoomCompareViewer;
