import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import BrushCursor from '@/components/tools/BrushCursor';
import type { SlimMaskState } from '@/components/tools/skinRetouch/useSlimMask';

export type BrushMode = 'slim' | 'redraw';

interface Props {
  /** Фото, на котором рисуется маска */
  imageUrl: string;
  /** То же фото с применённой пластикой ползунков — для предпросмотра (необязательно) */
  previewUrl?: string;
  /** Маска «Похудеть» */
  slimMask: SlimMaskState;
  /** Маска «Разгладить» */
  redrawMask: SlimMaskState;
  disabled?: boolean;
  busy?: boolean;
  /** Цена генеративной обработки одной маски */
  aiNote?: number | null;
  /** Подпись под фото (что будет после рисования) */
  footer?: string;
}

const BRUSH_KEY = 'retouch_slim_brush';
const TINT: Record<BrushMode, string> = { slim: '#ec4899', redraw: '#0ea5e9' };

/**
 * Одно окно с фото и двумя масками: переключателем выбираете,
 * какую кисть рисовать — «Похудеть» (розовая) или «Разгладить» (голубая).
 * Обе маски видны одновременно, активная — ярче.
 */
const SlimBrushEditor = ({ imageUrl, previewUrl, slimMask, redrawMask, disabled, busy, aiNote, footer }: Props) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const overlayRefs = { slim: useRef<HTMLCanvasElement | null>(null), redraw: useRef<HTMLCanvasElement | null>(null) };
  const drawingRef = useRef<{ erase: boolean; last: { x: number; y: number } | null } | null>(null);
  const [mode, setMode] = useState<BrushMode>('slim');
  const [view, setView] = useState<'brush' | 'result'>('brush');
  const [eraser, setEraser] = useState(false);
  const [brush, setBrushState] = useState<number>(() => Number(localStorage.getItem(BRUSH_KEY)) || 40);
  const setBrush = (v: number) => {
    setBrushState(v);
    localStorage.setItem(BRUSH_KEY, String(v));
  };
  const masks: Record<BrushMode, SlimMaskState> = { slim: slimMask, redraw: redrawMask };
  const mask = masks[mode];
  const isRedraw = mode === 'redraw';

  const sync = useCallback((m: SlimMaskState, ov: HTMLCanvasElement | null, tint: string) => {
    const src = m.canvas;
    if (!ov || !src.width) return;
    if (ov.width !== src.width || ov.height !== src.height) {
      ov.width = src.width;
      ov.height = src.height;
    }
    const ctx = ov.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, ov.width, ov.height);
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, ov.width, ov.height);
    ctx.globalCompositeOperation = 'source-over';
  }, []);

  useEffect(() => {
    sync(slimMask, overlayRefs.slim.current, TINT.slim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slimMask.version, slimMask.canvas, sync, view, imageUrl]);
  useEffect(() => {
    sync(redrawMask, overlayRefs.redraw.current, TINT.redraw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redrawMask.version, redrawMask.canvas, sync, view, imageUrl]);

  const activeOverlay = () => overlayRefs[mode].current!;

  const toImage = (e: React.PointerEvent) => {
    const ov = activeOverlay();
    const r = ov.getBoundingClientRect();
    const k = ov.width / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
  };

  const stroke = (from: { x: number; y: number } | null, to: { x: number; y: number }, width: number, erase: boolean) => {
    const targets: [HTMLCanvasElement, string][] = [
      [mask.canvas, '#fff'],
      [activeOverlay(), TINT[mode]],
    ];
    for (const [c, color] of targets) {
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = width;
      ctx.beginPath();
      if (from) {
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      } else {
        ctx.arc(to.x, to.y, width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (disabled || view !== 'brush' || !mask.canvas.width) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const erase = eraser || e.button === 2 || e.ctrlKey || e.metaKey;
    mask.snapshot();
    const p = toImage(e);
    stroke(null, p, brush * p.k, erase);
    drawingRef.current = { erase, last: p };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drawingRef.current;
    if (!d) return;
    const p = toImage(e);
    stroke(d.last, p, brush * p.k, d.erase);
    d.last = p;
  };

  const onUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = null;
    mask.commit();
  };

  const brushMode = view === 'brush' && !disabled;
  const tab = (active: boolean) =>
    `px-2.5 py-1.5 flex items-center gap-1.5 transition-colors ${active ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted'}`;

  return (
    <div className="rounded-lg border border-border p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-border overflow-hidden text-[12px]">
          <button type="button" onClick={() => { setMode('slim'); setView('brush'); }} className={tab(mode === 'slim')}>
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Похудеть
            {slimMask.hasPaint && <Icon name="Check" size={12} />}
          </button>
          <button type="button" onClick={() => { setMode('redraw'); setView('brush'); }} className={`${tab(mode === 'redraw')} border-l border-border`}>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Разгладить
            {redrawMask.hasPaint && <Icon name="Check" size={12} />}
          </button>
        </div>
        {previewUrl !== undefined && (
          <button
            type="button"
            onClick={() => setView(view === 'brush' ? 'result' : 'brush')}
            className={`ml-auto rounded-md border border-border px-2.5 py-1.5 text-[11px] flex items-center gap-1 ${view === 'result' ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          >
            <Icon name={view === 'result' ? 'EyeOff' : 'Eye'} size={12} /> Ползунки
          </button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {isRedraw
          ? 'Закрасьте складку или тень — AI перерисует это место ровной тканью по соседней.'
          : 'Закрасьте контур руки, бока или спины с небольшим запасом — AI выровняет линию и, если нужно, чуть сузит.'}
      </p>

      <div
        ref={boxRef}
        className={`relative rounded-lg overflow-hidden bg-black/5 select-none mx-auto w-fit ${brushMode ? 'touch-none cursor-none' : ''}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img
          src={view === 'result' ? previewUrl || imageUrl : imageUrl}
          alt="Фото"
          className="block max-w-full h-auto"
          style={{ maxHeight: '62vh' }}
          draggable={false}
        />
        {(['slim', 'redraw'] as BrushMode[]).map((m) => (
          <canvas
            key={m}
            ref={overlayRefs[m]}
            className="absolute inset-0 w-full h-full"
            style={{
              opacity: view !== 'brush' ? 0 : m === mode ? 0.45 : 0.18,
              pointerEvents: brushMode && m === mode ? 'auto' : 'none',
              zIndex: m === mode ? 2 : 1,
            }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        ))}
        <BrushCursor containerRef={boxRef} diameter={brush} enabled={brushMode} />
        {busy && view === 'result' && (
          <span className="absolute top-2 right-2 z-10 text-[11px] text-white bg-black/60 px-2 py-0.5 rounded flex items-center gap-1">
            <Icon name="Loader2" size={12} className="animate-spin" /> применяем...
          </span>
        )}
        {view === 'result' && (
          <span className="absolute top-2 left-2 z-10 text-[11px] font-medium text-white bg-black/60 px-2 py-0.5 rounded">
            Предпросмотр ползунков
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-medium">Размер кисти</span>
            <span className="tabular-nums text-muted-foreground">{brush}</span>
          </div>
          <Slider value={[brush]} min={8} max={160} step={2} onValueChange={([v]) => setBrush(v)} disabled={disabled} />
        </div>
        {!isRedraw ? (
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium">Сужение</span>
              <span className="tabular-nums text-muted-foreground">
                {slimMask.amount === 0 ? 'только выровнять' : `${slimMask.amount}%`}
              </span>
            </div>
            <Slider value={[slimMask.amount]} min={0} max={100} step={5} onValueChange={([v]) => slimMask.setAmount(v)} disabled={disabled} />
            <p className="text-[10px] text-muted-foreground mt-1">0 — AI только выпрямит выпирающие линии, форма не сжимается</p>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-medium mb-1 flex items-center gap-1">
              <Icon name="Sparkles" size={12} className="text-primary" /> Делает генеративная модель
            </p>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Закрашенное место модель не видит и рисует заново — складка и тень исчезают.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEraser(false)}
          className={`rounded-md border px-2.5 py-1 text-[11px] flex items-center gap-1 disabled:opacity-60 ${!eraser ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}
        >
          <Icon name="Brush" size={12} /> Кисть
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEraser(true)}
          className={`rounded-md border px-2.5 py-1 text-[11px] flex items-center gap-1 disabled:opacity-60 ${eraser ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}
        >
          <Icon name="Eraser" size={12} /> Ластик
        </button>
        <button
          type="button"
          disabled={disabled || mask.historyLen === 0}
          onClick={mask.undo}
          className="rounded-md border border-border px-2.5 py-1 text-[11px] flex items-center gap-1 hover:border-primary/40 disabled:opacity-50"
        >
          <Icon name="Undo2" size={12} /> Отменить
        </button>
        <button
          type="button"
          disabled={disabled || !mask.hasPaint}
          onClick={mask.clear}
          className="rounded-md border border-border px-2.5 py-1 text-[11px] flex items-center gap-1 hover:border-primary/40 disabled:opacity-50"
        >
          <Icon name="X" size={12} /> Очистить
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        ПКМ или Ctrl — ластик. Каждая нарисованная маска — отдельная обработка AI
        {aiNote ? ` (+${aiNote} ⚡)` : ''}. {footer || ''}
      </p>
    </div>
  );
};

export default SlimBrushEditor;
