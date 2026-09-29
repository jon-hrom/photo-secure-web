import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import BrushCursor from '@/components/tools/BrushCursor';
import type { SlimMaskState } from '@/components/tools/skinRetouch/useSlimMask';

interface Props {
  /** Фото, на котором рисуется маска (без пластики) */
  imageUrl: string;
  /** То же фото с применённой пластикой — для просмотра результата */
  previewUrl: string;
  mask: SlimMaskState;
  disabled?: boolean;
  busy?: boolean;
  /** Цена генеративной пластики по маске */
  aiNote?: number | null;
  /** slim — «Похудеть» (сужение + доводка AI), redraw — «Разгладить» (AI перерисовывает зону) */
  variant?: 'slim' | 'redraw';
}

const BRUSH_KEY = 'retouch_slim_brush';

/**
 * Кисть «Похудеть»: закрашиваете жировые складки, бока, участки рук —
 * закрашенное место сжимается к своей середине. Как «Удалить объект»,
 * только вместо удаления — пластика.
 */
const SlimBrushEditor = ({ imageUrl, previewUrl, mask, disabled, busy, aiNote, variant = 'slim' }: Props) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<{ erase: boolean; last: { x: number; y: number } | null } | null>(null);
  const [view, setView] = useState<'brush' | 'result'>('brush');
  const isRedraw = variant === 'redraw';
  const tint = isRedraw ? '#0ea5e9' : '#ec4899';
  const [eraser, setEraser] = useState(false);
  const brushKey = `${BRUSH_KEY}_${variant}`;
  const [brush, setBrushState] = useState<number>(() => Number(localStorage.getItem(brushKey)) || 40);
  const setBrush = (v: number) => {
    setBrushState(v);
    localStorage.setItem(brushKey, String(v));
  };

  /** Перерисовка розовой подсветки маски из самой маски (после отмены/очистки). */
  const syncOverlay = useCallback(() => {
    const ov = overlayRef.current;
    const m = mask.canvas;
    if (!ov || !m.width) return;
    if (ov.width !== m.width || ov.height !== m.height) {
      ov.width = m.width;
      ov.height = m.height;
    }
    const ctx = ov.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, ov.width, ov.height);
    ctx.drawImage(m, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, ov.width, ov.height);
    ctx.globalCompositeOperation = 'source-over';
  }, [mask.canvas, tint]);

  useEffect(() => {
    syncOverlay();
  }, [mask.version, syncOverlay, view]);

  const toImage = (e: React.PointerEvent) => {
    const ov = overlayRef.current!;
    const r = ov.getBoundingClientRect();
    const k = ov.width / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
  };

  const stroke = (from: { x: number; y: number } | null, to: { x: number; y: number }, width: number, erase: boolean) => {
    const targets: [HTMLCanvasElement, string][] = [
      [mask.canvas, '#fff'],
      [overlayRef.current!, tint],
    ];
    for (const [c, color] of targets) {
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = width;
      if (from) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
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

  return (
    <div className="rounded-lg border border-border p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon name={isRedraw ? 'Wand2' : 'Brush'} size={16} className={mask.hasPaint ? (isRedraw ? 'text-sky-500' : 'text-pink-500') : 'text-muted-foreground'} />
        <p className="text-xs font-medium">{isRedraw ? 'Кисть «Разгладить»' : 'Кисть «Похудеть»'}</p>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          {isRedraw ? '— закрасьте висящую складку, AI перерисует её ровной тканью' : '— закрасьте руку, бок, спину'}
        </span>
        <div className={`ml-auto flex rounded-md border border-border overflow-hidden text-[11px] ${isRedraw ? 'hidden' : ''}`}>
          <button
            type="button"
            onClick={() => setView('brush')}
            className={`px-2.5 py-1 flex items-center gap-1 ${view === 'brush' ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          >
            <Icon name="Brush" size={12} /> Маска
          </button>
          <button
            type="button"
            onClick={() => setView('result')}
            className={`px-2.5 py-1 flex items-center gap-1 border-l border-border ${view === 'result' ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          >
            <Icon name="Eye" size={12} /> Ползунки
          </button>
        </div>
      </div>

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
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: view === 'brush' ? 0.45 : 0, pointerEvents: brushMode ? 'auto' : 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <BrushCursor containerRef={boxRef} diameter={brush} enabled={brushMode} />
        {busy && view === 'result' && (
          <span className="absolute top-2 right-2 text-[11px] text-white bg-black/60 px-2 py-0.5 rounded flex items-center gap-1">
            <Icon name="Loader2" size={12} className="animate-spin" /> применяем...
          </span>
        )}
        {view === 'result' && (
          <span className="absolute top-2 left-2 text-[11px] font-medium text-white bg-black/60 px-2 py-0.5 rounded">
            Предпросмотр
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
        <div>
          <p className="text-[11px] font-medium mb-1 flex items-center gap-1">
            <Icon name="Sparkles" size={12} className="text-primary" /> Делает генеративная модель
          </p>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {isRedraw
              ? 'Закрашенное место модель не видит и рисует заново по соседней ткани — складка и тень исчезают.'
              : 'Сузит объём и уберёт складки в закрашенной зоне, сохранит ткань и кружево.'}
            {aiNote ? ` +${aiNote} ⚡ к ретуши, если маска нарисована.` : ''}
          </p>
        </div>
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
        {isRedraw
          ? 'Закрашивайте только саму складку и тень под ней, без рукава и лица. Чем меньше зона, тем точнее ткань совпадёт с соседней. ПКМ или Ctrl — ластик. Результат — после кнопки «Ретушь».'
          : 'Закрашивайте руку, складку или бок целиком, чуть заходя за контур тела — модели нужен запас, чтобы провести новый ровный контур. ПКМ или Ctrl — ластик. Результат появится после кнопки «Ретушь». Вкладка «Ползунки» показывает только действие ползунков пластики.'}
      </p>
    </div>
  );
};

export default SlimBrushEditor;
