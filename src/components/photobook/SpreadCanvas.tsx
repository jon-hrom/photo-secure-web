import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';
import type { UploadedPhoto } from './PhotobookCreator';

interface CollageSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  photoId?: string;
}

interface Spread {
  id: string;
  type: 'cover' | 'spread';
  collageId: string;
  slots: CollageSlot[];
}

interface SpreadCanvasProps {
  spreads: Spread[];
  selectedSpreadIndex: number;
  photos: UploadedPhoto[];
  dimensions: { width: number; height: number };
  spinePosition: number;
  spineWidth: number;
  manualMode: boolean;
  selectedSlotIndex: number | null;
  onPrevSpread: () => void;
  onNextSpread: () => void;
  onSpreadClick: (index: number) => void;
  onSlotMouseDown: (e: React.MouseEvent<SVGRectElement>, slotIndex: number) => void;
  onResizeMouseDown: (e: React.MouseEvent, slotIndex: number, corner: 'tl' | 'tr' | 'bl' | 'br') => void;
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseUp: () => void;
  showRulers?: boolean;
}

const SpreadCanvas = ({
  spreads,
  selectedSpreadIndex,
  photos,
  dimensions,
  spinePosition,
  spineWidth,
  manualMode,
  selectedSlotIndex,
  onPrevSpread,
  onNextSpread,
  onSpreadClick,
  onSlotMouseDown,
  onResizeMouseDown,
  onMouseMove,
  onMouseUp,
  showRulers = false
}: SpreadCanvasProps) => {
  const canvasRef = useRef<SVGSVGElement>(null);
  const selectedSpread = spreads[selectedSpreadIndex];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-center gap-2 md:gap-4 mb-2 md:mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevSpread}
          disabled={selectedSpreadIndex === 0}
        >
          <Icon name="ChevronLeft" size={16} />
        </Button>
        
        <span className="text-sm md:text-lg font-semibold whitespace-nowrap">
          {selectedSpread.type === 'cover' ? 'Обложка' : `Разворот ${selectedSpreadIndex}`}
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onNextSpread}
          disabled={selectedSpreadIndex === spreads.length - 1}
        >
          <Icon name="ChevronRight" size={16} />
        </Button>
      </div>

      <div className="flex-1 flex bg-gray-100 rounded-lg p-2 md:p-8 overflow-auto min-h-0">
        {showRulers && (
          <div className="hidden md:flex flex-col mr-2">
            <div className="h-8" />
            <div className="flex-1 relative">
              <div className="absolute left-0 top-0 h-full w-8 bg-white border border-gray-300 flex flex-col justify-between text-xs text-gray-600">
                {Array.from({ length: 21 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-center">
                    {i * 50}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center">
          {showRulers && (
            <div className="w-full relative mb-2 hidden md:block">
              <img 
                src="https://cdn.poehali.dev/files/ba72d947-c38f-439e-ae19-33ece18e0252.png" 
                alt="Линейка" 
                className="w-full h-8 object-contain"
              />
            </div>
          )}
          <svg
            ref={canvasRef}
            viewBox={`0 0 ${dimensions.width * 2} ${dimensions.height}`}
            className="w-full h-auto max-w-full border-2 border-gray-300 bg-white"
            style={{ maxHeight: '60vh' }}
            preserveAspectRatio="xMidYMid meet"
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
          <rect x={0} y={0} width={dimensions.width} height={dimensions.height} fill="#ffffff" />
          <rect x={dimensions.width} y={0} width={dimensions.width} height={dimensions.height} fill="#ffffff" />
          <rect
            x={spinePosition - spineWidth / 2}
            y={0}
            width={spineWidth}
            height={dimensions.height}
            fill="#e5e7eb"
          />

          {selectedSpread.slots.map((slot, idx) => {
            const isSelected = manualMode && selectedSlotIndex === idx;
            const photo = slot.photoId ? photos.find(p => p.id === slot.photoId) : null;
            
            return (
              <g key={idx}>
                {photo ? (
                  <image
                    href={photo.url}
                    x={slot.x}
                    y={slot.y}
                    width={slot.width}
                    height={slot.height}
                    preserveAspectRatio="xMidYMid slice"
                    style={{ cursor: manualMode ? 'move' : 'default' }}
                    onMouseDown={(e: any) => onSlotMouseDown(e, idx)}
                  />
                ) : (
                  <>
                    <rect
                      x={slot.x}
                      y={slot.y}
                      width={slot.width}
                      height={slot.height}
                      fill="#f3f4f6"
                      stroke={isSelected ? '#8b5cf6' : '#d1d5db'}
                      strokeWidth={isSelected ? '3' : '2'}
                      style={{ cursor: manualMode ? 'move' : 'default' }}
                      onMouseDown={(e: any) => onSlotMouseDown(e, idx)}
                    />
                    <circle
                      cx={slot.x + slot.width / 2}
                      cy={slot.y + slot.height / 2}
                      r="20"
                      fill="#d1d5db"
                    />
                    <text
                      x={slot.x + slot.width / 2}
                      y={slot.y + slot.height / 2}
                      fontSize="24"
                      fill="#9ca3af"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      📷
                    </text>
                  </>
                )}
                
                {isSelected && manualMode && (
                  <>
                    <circle cx={slot.x} cy={slot.y} r="6" fill="#8b5cf6" style={{ cursor: 'nwse-resize' }} onMouseDown={(e: any) => onResizeMouseDown(e, idx, 'tl')} />
                    <circle cx={slot.x + slot.width} cy={slot.y} r="6" fill="#8b5cf6" style={{ cursor: 'nesw-resize' }} onMouseDown={(e: any) => onResizeMouseDown(e, idx, 'tr')} />
                    <circle cx={slot.x} cy={slot.y + slot.height} r="6" fill="#8b5cf6" style={{ cursor: 'nesw-resize' }} onMouseDown={(e: any) => onResizeMouseDown(e, idx, 'bl')} />
                    <circle cx={slot.x + slot.width} cy={slot.y + slot.height} r="6" fill="#8b5cf6" style={{ cursor: 'nwse-resize' }} onMouseDown={(e: any) => onResizeMouseDown(e, idx, 'br')} />
                  </>
                )}
              </g>
            );
          })}
          </svg>
        </div>
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="BookOpen" size={16} />
          <span className="text-sm font-semibold">Менеджер разворотов</span>
        </div>
        
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {spreads.map((spread, idx) => (
              <button
                key={spread.id}
                onClick={() => onSpreadClick(idx)}
                className={`flex-shrink-0 w-32 border-2 rounded p-2 transition-all ${
                  selectedSpreadIndex === idx
                    ? 'border-purple-600 ring-2 ring-purple-200 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="aspect-video bg-gray-100 rounded mb-1 flex items-center justify-center">
                  <Icon name="LayoutTemplate" size={20} className="text-gray-400" />
                </div>
                <p className="text-xs text-center">
                  {spread.type === 'cover' ? 'Обложка' : `Разворот ${idx}`}
                </p>
              </button>
            ))}
            
            <button className="flex-shrink-0 w-32 border-2 border-dashed border-gray-300 rounded p-2 flex items-center justify-center hover:border-gray-400 transition-colors">
              <Icon name="Plus" size={24} className="text-gray-400" />
            </button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default SpreadCanvas;