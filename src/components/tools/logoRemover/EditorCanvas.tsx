import { RefObject } from 'react';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';
import { EditorTool } from '@/components/tools/logoRemover/useCanvasState';
import { MAX_ZOOM } from '@/components/tools/logoRemover/useBrushInteractions';
import BrushCursor from '@/components/tools/BrushCursor';

interface EditorCanvasProps {
  tool: EditorTool;
  setTool: (t: EditorTool) => void;
  viewportRef: RefObject<HTMLDivElement>;
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  maskCanvasRef: RefObject<HTMLCanvasElement>;
  pointersRef: RefObject<Map<number, { x: number; y: number }>>;
  zoom: number;
  pan: { x: number; y: number };
  loading: boolean;
  loadingText: string;
  brushSize: number;
  setBrushSize: (n: number) => void;
  setZoom: (updater: (z: number) => number) => void;
  resetZoom: () => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  /** Масштаб к центру видимой области (кнопки/ползунок). */
  zoomBy?: (factor: number) => void;
}

const btn =
  'w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-black/60 hover:bg-black/80 active:bg-black/90 text-white backdrop-blur-sm flex items-center justify-center transition-colors touch-manipulation';

const EditorCanvas = ({
  tool,
  setTool,
  viewportRef,
  imageCanvasRef,
  maskCanvasRef,
  pointersRef,
  zoom,
  pan,
  loading,
  loadingText,
  brushSize,
  setBrushSize,
  setZoom,
  resetZoom,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  zoomBy,
}: EditorCanvasProps) => {
  const zoomIn = () => (zoomBy ? zoomBy(1.4) : setZoom((z) => Math.min(MAX_ZOOM, z * 1.4)));
  const zoomOut = () => (zoomBy ? zoomBy(1 / 1.4) : setZoom((z) => Math.max(1, z / 1.4)));
  const zoomTo = (target: number) => (zoomBy ? zoomBy(target / zoom) : setZoom(() => target));
  const busyGesture = tool === 'pan' || (pointersRef.current?.size ?? 0) >= 1;

  return (
    <>
      <div
        ref={viewportRef}
        className="relative rounded-xl overflow-hidden border border-border touch-none select-none overscroll-contain"
        style={{
          backgroundImage: 'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0',
          height: '60dvh',
          maxHeight: '60vh',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="absolute inset-0 flex items-center justify-center will-change-transform"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: busyGesture ? 'none' : 'transform 0.12s ease-out',
          }}
        >
          <div className="relative">
            <canvas
              ref={imageCanvasRef}
              className="block max-w-full h-auto select-none"
              style={{ maxHeight: '60vh', imageRendering: zoom >= 3 ? 'pixelated' : 'auto' }}
            />
            <canvas
              ref={maskCanvasRef}
              className={`absolute inset-0 w-full h-full touch-none ${tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-none'}`}
              style={{ maxHeight: '60vh' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </div>

        <div className="absolute top-2 left-2 flex gap-1 z-10">
          <button
            type="button"
            onClick={() => setTool('brush')}
            className={`h-10 sm:h-9 px-3 rounded-lg backdrop-blur-sm flex items-center gap-1.5 text-xs font-medium transition-colors touch-manipulation ${
              tool === 'brush' ? 'bg-pink-500 text-white' : 'bg-black/60 text-white hover:bg-black/80'
            }`}
            title="Кисть — рисовать маску"
          >
            <Icon name="Brush" size={15} />
            Кисть
          </button>
          <button
            type="button"
            onClick={() => setTool('pan')}
            className={`h-10 sm:h-9 px-3 rounded-lg backdrop-blur-sm flex items-center gap-1.5 text-xs font-medium transition-colors touch-manipulation ${
              tool === 'pan' ? 'bg-primary text-primary-foreground' : 'bg-black/60 text-white hover:bg-black/80'
            }`}
            title="Двигать фото (при увеличении)"
          >
            <Icon name="Move" size={15} />
            Двигать
          </button>
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          <button type="button" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} className={`${btn} disabled:opacity-40`} title="Приблизить">
            <Icon name="ZoomIn" size={18} />
          </button>
          <button type="button" onClick={zoomOut} disabled={zoom <= 1.001} className={`${btn} disabled:opacity-40`} title="Отдалить">
            <Icon name="ZoomOut" size={18} />
          </button>
          <button type="button" onClick={resetZoom} disabled={zoom <= 1.001} className={`${btn} disabled:opacity-40`} title="Всё фото целиком">
            <Icon name="Maximize2" size={16} />
          </button>
        </div>

        <BrushCursor
          containerRef={viewportRef}
          diameter={Math.max(4, brushSize * 2)}
          enabled={tool === 'brush' && !loading}
        />

        {zoom > 1.01 && (
          <div className="absolute bottom-2 left-2 text-[11px] text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded pointer-events-none">
            {Math.round(zoom * 100)}%
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm z-40">
            <Icon name="Loader2" size={36} className="animate-spin mb-2" />
            <p className="text-sm px-4 text-center">{loadingText || 'Обработка...'}</p>
          </div>
        )}
      </div>

      <div className="space-y-2.5 px-1">
        <div className="flex items-center gap-3">
          <Icon name="ZoomIn" size={16} className="text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-shrink-0 w-12">{Math.round(zoom * 100)}%</span>
          <Slider
            value={[zoom]}
            min={1}
            max={MAX_ZOOM}
            step={0.1}
            onValueChange={(v) => zoomTo(v[0])}
            className="flex-1 py-2"
          />
          <div className="flex gap-1 flex-shrink-0">
            {[2, 4].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => zoomTo(z)}
                className={`h-8 px-2 rounded-md border text-[11px] transition-colors touch-manipulation ${
                  Math.abs(zoom - z) < 0.05 ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
                }`}
              >
                ×{z}
              </button>
            ))}
          </div>
        </div>

        {tool === 'brush' ? (
          <div className="flex items-center gap-3">
            <Icon name="Brush" size={16} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground flex-shrink-0 w-12">{brushSize}px</span>
            <Slider
              value={[brushSize]}
              min={2}
              max={80}
              step={1}
              onValueChange={(v) => setBrushSize(v[0])}
              className="flex-1 py-2"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="Move" size={16} className="flex-shrink-0" />
            Тяните фото пальцем или мышью. Кнопка «Кисть» — вернуться к маске
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          <span className="sm:hidden">Два пальца — приблизить и сдвинуть фото, один палец — рисовать.</span>
          <span className="hidden sm:inline">Колесо мыши — приблизить к курсору, средняя кнопка или «Двигать» — сдвинуть фото.</span>
          {' '}Кисть рисует в размере экрана: при увеличении маска ложится точнее.
        </p>
      </div>
    </>
  );
};

export default EditorCanvas;
