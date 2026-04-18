import { RefObject } from 'react';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';

interface EditorCanvasProps {
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
}

const EditorCanvas = ({
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
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: EditorCanvasProps) => {
  return (
    <>
      <div
        ref={viewportRef}
        className="relative rounded-xl overflow-hidden border border-border touch-none"
        style={{
          backgroundImage: 'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0',
          height: '60vh',
        }}
        onWheel={onWheel}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: (pointersRef.current?.size ?? 0) >= 2 ? 'none' : 'transform 0.08s ease-out',
          }}
        >
          <div className="relative">
            <canvas
              ref={imageCanvasRef}
              className="block max-w-full h-auto select-none"
              style={{ maxHeight: '60vh' }}
            />
            <canvas
              ref={maskCanvasRef}
              className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
              style={{ maxHeight: '60vh' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          <button
            onClick={() => setZoom((z) => Math.min(6, z * 1.25))}
            className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm flex items-center justify-center transition-colors"
            title="Приблизить"
          >
            <Icon name="ZoomIn" size={16} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(1, z / 1.25))}
            className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm flex items-center justify-center transition-colors"
            title="Отдалить"
          >
            <Icon name="ZoomOut" size={16} />
          </button>
          <button
            onClick={resetZoom}
            className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm flex items-center justify-center transition-colors"
            title="Сбросить масштаб"
          >
            <Icon name="Maximize2" size={16} />
          </button>
        </div>

        {zoom > 1.01 && (
          <div className="absolute bottom-2 left-2 text-[11px] text-white bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded">
            {Math.round(zoom * 100)}%
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm z-20">
            <Icon name="Loader2" size={36} className="animate-spin mb-2" />
            <p className="text-sm">{loadingText || 'Обработка...'}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-1">
        <Icon name="Brush" size={16} className="text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground flex-shrink-0 w-10">{brushSize}px</span>
        <Slider
          value={[brushSize]}
          min={5}
          max={80}
          step={1}
          onValueChange={(v) => setBrushSize(v[0])}
          className="flex-1"
        />
      </div>
    </>
  );
};

export default EditorCanvas;
