import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import type { PhotobookFormat, PhotoSlot } from './PhotobookCreator';

interface PhotobookLayoutDesignerProps {
  format: PhotobookFormat;
  photosPerSpread: number;
  onPhotosPerSpreadChange: (count: number) => void;
  onConfirm: (slots: PhotoSlot[]) => void;
  onBack: () => void;
}

const SAFE_MARGIN = 5;

const getFormatDimensions = (format: PhotobookFormat): { width: number; height: number } => {
  switch (format) {
    case '20x20':
      return { width: 400, height: 200 };
    case '21x30':
      return { width: 420, height: 300 };
    case '30x30':
      return { width: 600, height: 300 };
  }
};

const generateLayout = (
  photosCount: number,
  spreadWidth: number,
  spreadHeight: number
): PhotoSlot[] => {
  const slots: PhotoSlot[] = [];
  const safeWidth = spreadWidth - SAFE_MARGIN * 2;
  const safeHeight = spreadHeight - SAFE_MARGIN * 2;
  
  const rows = Math.ceil(Math.sqrt(photosCount));
  const cols = Math.ceil(photosCount / rows);
  
  const slotWidth = safeWidth / cols - 10;
  const slotHeight = safeHeight / rows - 10;
  
  for (let i = 0; i < photosCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const isHorizontal = slotWidth > slotHeight;
    
    slots.push({
      id: `slot-${i}`,
      orientation: isHorizontal ? 'horizontal' : 'vertical',
      x: SAFE_MARGIN + col * (slotWidth + 10) + 5,
      y: SAFE_MARGIN + row * (slotHeight + 10) + 5,
      width: slotWidth,
      height: slotHeight,
    });
  }
  
  return slots;
};

const generateRandomLayout = (
  photosCount: number,
  spreadWidth: number,
  spreadHeight: number
): PhotoSlot[] => {
  const slots: PhotoSlot[] = [];
  const safeWidth = spreadWidth - SAFE_MARGIN * 2;
  const safeHeight = spreadHeight - SAFE_MARGIN * 2;
  
  const minSlotSize = Math.min(safeWidth, safeHeight) / 4;
  const maxSlotSize = Math.min(safeWidth, safeHeight) / 2;
  
  for (let i = 0; i < photosCount; i++) {
    const isHorizontal = Math.random() > 0.5;
    const width = minSlotSize + Math.random() * (maxSlotSize - minSlotSize);
    const height = minSlotSize + Math.random() * (maxSlotSize - minSlotSize);
    
    const x = SAFE_MARGIN + Math.random() * (safeWidth - width);
    const y = SAFE_MARGIN + Math.random() * (safeHeight - height);
    
    slots.push({
      id: `slot-${i}`,
      orientation: isHorizontal ? 'horizontal' : 'vertical',
      x,
      y,
      width,
      height,
    });
  }
  
  return slots;
};

const PhotobookLayoutDesigner = ({
  format,
  photosPerSpread,
  onPhotosPerSpreadChange,
  onConfirm,
  onBack,
}: PhotobookLayoutDesignerProps) => {
  const [layoutVariant, setLayoutVariant] = useState(0);
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([]);
  
  const dimensions = getFormatDimensions(format);

  useEffect(() => {
    const newSlots = generateLayout(photosPerSpread, dimensions.width, dimensions.height);
    setPhotoSlots(newSlots);
  }, [photosPerSpread, format, dimensions.width, dimensions.height]);

  const handleNextVariant = () => {
    const newSlots = generateRandomLayout(photosPerSpread, dimensions.width, dimensions.height);
    setPhotoSlots(newSlots);
    setLayoutVariant((prev) => prev + 1);
  };

  const handlePrevVariant = () => {
    const newSlots = generateRandomLayout(photosPerSpread, dimensions.width, dimensions.height);
    setPhotoSlots(newSlots);
    setLayoutVariant((prev) => Math.max(0, prev - 1));
  };

  const handleConfirm = () => {
    onConfirm(photoSlots);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">Выберите макет разворота</h3>
        <p className="text-muted-foreground">
          Формат: <span className="font-semibold">{format.replace('x', '×')} см</span>
        </p>
      </div>

      <Card className="border-2">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="photosCount">Количество фото на развороте</Label>
              <Input
                id="photosCount"
                type="number"
                min="1"
                max="20"
                value={photosPerSpread}
                onChange={(e) => onPhotosPerSpreadChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-2"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <div>Разворот = 2 страницы</div>
              <div>Безопасная зона: {SAFE_MARGIN} мм</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-semibold">Предпросмотр макета</h4>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevVariant}
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
                onClick={handleNextVariant}
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
              <rect
                x={SAFE_MARGIN}
                y={SAFE_MARGIN}
                width={dimensions.width - SAFE_MARGIN * 2}
                height={dimensions.height - SAFE_MARGIN * 2}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {photoSlots.map((slot) => (
                <g key={slot.id}>
                  <rect
                    x={slot.x}
                    y={slot.y}
                    width={slot.width}
                    height={slot.height}
                    fill="#f3f4f6"
                    stroke="#9ca3af"
                    strokeWidth="2"
                    strokeDasharray="4 2"
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

      <div className="flex justify-between gap-4">
        <Button variant="outline" onClick={onBack} className="rounded-full">
          <Icon name="ArrowLeft" size={18} className="mr-2" />
          Назад
        </Button>
        <Button onClick={handleConfirm} className="rounded-full">
          Далее
          <Icon name="ArrowRight" size={18} className="ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default PhotobookLayoutDesigner;
