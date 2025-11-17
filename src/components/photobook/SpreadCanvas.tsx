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
  onMouseUp
}: SpreadCanvasProps) => {
  const canvasRef = useRef<SVGSVGElement>(null);
  const selectedSpread = spreads[selectedSpreadIndex];

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-center gap-4 mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevSpread}
          disabled={selectedSpreadIndex === 0}
        >
          <Icon name="ChevronLeft" size={20} />
        </Button>
        
        <span className="text-lg font-semibold">
          {selectedSpread.type === 'cover' ? 'Обложка' : `Разворот ${selectedSpreadIndex}`}
        </span>
        
        <Button
          variant="outline"
          size="icon"
          onClick={onNextSpread}
          disabled={selectedSpreadIndex === spreads.length - 1}
        >
          <Icon name="ChevronRight" size={20} />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg p-8">
        <svg
          ref={canvasRef}
          viewBox={`0 0 ${dimensions.width * 2} ${dimensions.height}`}
          className="max-w-full max-h-full border-2 border-gray-300 bg-white"
          style={{ aspectRatio: `${dimensions.width * 2} / ${dimensions.height}` }}
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
