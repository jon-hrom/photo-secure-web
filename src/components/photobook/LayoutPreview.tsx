import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { PhotoSlot } from './PhotobookCreator';
import { SAFE_MARGIN } from './layoutUtils';

interface LayoutPreviewProps {
  dimensions: { width: number; height: number };
  photoSlots: PhotoSlot[];
  layoutVariant: number;
  onNextVariant: () => void;
  onPrevVariant: () => void;
}

const LayoutPreview = ({ 
  dimensions, 
  photoSlots, 
  layoutVariant, 
  onNextVariant, 
  onPrevVariant 
}: LayoutPreviewProps) => {
  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-semibold">Предпросмотр макета</h4>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevVariant}
              disabled={layoutVariant === 0}
            >
              <Icon name="ChevronLeft" size={16} />
            </Button>
            <span className="text-sm text-muted-foreground px-3">
              Вариант {layoutVariant + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextVariant}
            >
              <Icon name="ChevronRight" size={16} />
            </Button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
          <svg
            width={dimensions.width}
            height={dimensions.height}
            className="mx-auto border-2 border-gray-300"
            style={{ backgroundColor: 'white' }}
          >
            <line
              x1={dimensions.width / 2}
              y1={0}
              x2={dimensions.width / 2}
              y2={dimensions.height}
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="8,4"
              opacity="0.6"
            />
            <text
              x={dimensions.width / 2}
              y={15}
              textAnchor="middle"
              fill="#ef4444"
              fontSize="10"
              fontWeight="bold"
            >
              Центральный сгиб
            </text>
            <rect
              x={SAFE_MARGIN}
              y={SAFE_MARGIN}
              width={dimensions.width - SAFE_MARGIN * 2}
              height={dimensions.height - SAFE_MARGIN * 2}
              fill="none"
              stroke="#d1d5db"
              strokeWidth="1"
              strokeDasharray="4,2"
            />
            
            {photoSlots.map((slot) => (
              <g key={slot.id}>
                <rect
                  x={slot.x}
                  y={slot.y}
                  width={slot.width}
                  height={slot.height}
                  fill="#e5e7eb"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                  rx="4"
                />
                <text
                  x={slot.x + slot.width / 2}
                  y={slot.y + slot.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="12"
                  fill="#6b7280"
                >
                  {slot.orientation === 'horizontal' ? '📷' : '📸'}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="Info" size={16} />
          <span>Окошки показывают предполагаемые места для фотографий</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default LayoutPreview;
