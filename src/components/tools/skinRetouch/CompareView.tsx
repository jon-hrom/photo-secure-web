import { useRef } from 'react';
import Icon from '@/components/ui/icon';

interface CompareViewProps {
  originalUrl: string;
  resultUrl: string;
  compare: number;
  setCompare: (v: number) => void;
}

/** Шторка «до/после»: слева оригинал, справа результат. */
const CompareView = ({ originalUrl, resultUrl, compare, setCompare }: CompareViewProps) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const moveTo = (clientX: number) => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setCompare(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div
      ref={boxRef}
      className="relative rounded-xl overflow-hidden border border-border select-none touch-none bg-black/5"
      onPointerDown={(e) => {
        draggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        moveTo(e.clientX);
      }}
      onPointerMove={(e) => draggingRef.current && moveTo(e.clientX)}
      onPointerUp={() => { draggingRef.current = false; }}
      onPointerCancel={() => { draggingRef.current = false; }}
    >
      <img
        src={resultUrl}
        alt="После ретуши"
        className="block w-full h-auto"
        style={{ maxHeight: '62vh', objectFit: 'contain' }}
        draggable={false}
      />

      {/* Оригинал лежит ровно поверх результата и обрезается шторкой —
          так кадры совпадают пиксель в пиксель при любом размере. */}
      <img
        src={originalUrl}
        alt="До ретуши"
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'contain', clipPath: `inset(0 ${100 - compare}% 0 0)` }}
        draggable={false}
      />

      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)] pointer-events-none" style={{ left: `${compare}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-0 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center">
          <Icon name="ChevronsLeftRight" size={18} className="text-black" />
        </div>
      </div>

      <span className="absolute top-2 left-2 text-[11px] font-medium text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded">До</span>
      <span className="absolute top-2 right-2 text-[11px] font-medium text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded">После</span>
    </div>
  );
};

export default CompareView;