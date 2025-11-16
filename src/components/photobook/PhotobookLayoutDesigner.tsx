import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import type { PhotobookFormat, PhotoSlot } from './PhotobookCreator';

interface PhotobookLayoutDesignerProps {
  format: PhotobookFormat;
  photosPerSpread: number;
  onPhotosPerSpreadChange: (count: number) => void;
  onConfirm: (slots: PhotoSlot[], photoSpacing: number) => void;
  onBack: () => void;
}

const SAFE_MARGIN = 5;
const DEFAULT_PHOTO_SPACING = 5;

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
  spreadHeight: number,
  spacing: number
): PhotoSlot[] => {
  const slots: PhotoSlot[] = [];
  const safeWidth = spreadWidth - SAFE_MARGIN * 2;
  const safeHeight = spreadHeight - SAFE_MARGIN * 2;
  
  if (photosCount === 0) return slots;
  
  const rows = Math.ceil(Math.sqrt(photosCount));
  const cols = Math.ceil(photosCount / rows);
  
  const totalSpacingWidth = spacing * (cols - 1);
  const totalSpacingHeight = spacing * (rows - 1);
  
  const slotWidth = (safeWidth - totalSpacingWidth) / cols;
  const slotHeight = (safeHeight - totalSpacingHeight) / rows;
  
  for (let i = 0; i < photosCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const isHorizontal = slotWidth > slotHeight;
    
    slots.push({
      id: `slot-${i}`,
      orientation: isHorizontal ? 'horizontal' : 'vertical',
      x: SAFE_MARGIN + col * (slotWidth + spacing),
      y: SAFE_MARGIN + row * (slotHeight + spacing),
      width: slotWidth,
      height: slotHeight,
    });
  }
  
  return slots;
};

const generateRandomLayout = (
  photosCount: number,
  spreadWidth: number,
  spreadHeight: number,
  spacing: number
): PhotoSlot[] => {
  const slots: PhotoSlot[] = [];
  const safeWidth = spreadWidth - SAFE_MARGIN * 2;
  const safeHeight = spreadHeight - SAFE_MARGIN * 2;
  
  if (photosCount === 0) return slots;
  
  const minSlotSize = Math.min(safeWidth, safeHeight) / 4;
  const maxSlotSize = Math.min(safeWidth, safeHeight) / 2.5;
  
  const attempts = 100;
  
  for (let i = 0; i < photosCount; i++) {
    let placed = false;
    
    for (let attempt = 0; attempt < attempts && !placed; attempt++) {
      const isHorizontal = Math.random() > 0.5;
      const width = minSlotSize + Math.random() * (maxSlotSize - minSlotSize);
      const height = minSlotSize + Math.random() * (maxSlotSize - minSlotSize);
      
      const x = SAFE_MARGIN + Math.random() * (safeWidth - width);
      const y = SAFE_MARGIN + Math.random() * (safeHeight - height);
      
      const hasOverlap = slots.some(existingSlot => {
        const dx = Math.abs((x + width/2) - (existingSlot.x + existingSlot.width/2));
        const dy = Math.abs((y + height/2) - (existingSlot.y + existingSlot.height/2));
        return dx < (width/2 + existingSlot.width/2 + spacing) && 
               dy < (height/2 + existingSlot.height/2 + spacing);
      });
      
      if (!hasOverlap) {
        slots.push({
          id: `slot-${i}`,
          orientation: isHorizontal ? 'horizontal' : 'vertical',
          x,
          y,
          width,
          height,
        });
        placed = true;
      }
    }
    
    if (!placed) {
      return generateLayout(photosCount, spreadWidth, spreadHeight, spacing);
    }
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
  const [photoSpacing, setPhotoSpacing] = useState(DEFAULT_PHOTO_SPACING);
  const [customSpacing, setCustomSpacing] = useState(false);
  
  const dimensions = getFormatDimensions(format);

  useEffect(() => {
    const newSlots = generateLayout(photosPerSpread, dimensions.width, dimensions.height, photoSpacing);
    setPhotoSlots(newSlots);
  }, [photosPerSpread, format, dimensions.width, dimensions.height, photoSpacing]);

  const handleNextVariant = () => {
    const newSlots = generateRandomLayout(photosPerSpread, dimensions.width, dimensions.height, photoSpacing);
    setPhotoSlots(newSlots);
    setLayoutVariant((prev) => prev + 1);
  };

  const handlePrevVariant = () => {
    const newSlots = generateRandomLayout(photosPerSpread, dimensions.width, dimensions.height, photoSpacing);
    setPhotoSlots(newSlots);
    setLayoutVariant((prev) => Math.max(0, prev - 1));
  };

  const handleConfirm = () => {
    onConfirm(photoSlots, photoSpacing);
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
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="photosCount">Количество фото на развороте</Label>
              <Input
                id="photosCount"
                type="number"
                min="0"
                max="20"
                value={photosPerSpread}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                  if (!isNaN(val)) {
                    onPhotosPerSpreadChange(Math.max(0, Math.min(20, val)));
                  }
                }}
                className="mt-2"
              />
            </div>
            <div className="text-sm text-muted-foreground flex flex-col justify-end">
              <div>Разворот = 2 страницы</div>
              <div>Безопасная зона: {SAFE_MARGIN} мм</div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="customSpacing"
                checked={customSpacing}
                onCheckedChange={(checked) => setCustomSpacing(checked as boolean)}
              />
              <Label htmlFor="customSpacing" className="cursor-pointer">
                Настроить расстояние между фотографиями
              </Label>
            </div>
            
            {customSpacing && (
              <div>
                <Label htmlFor="photoSpacing">Расстояние между фото (мм)</Label>
                <Input
                  id="photoSpacing"
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={photoSpacing}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                    if (!isNaN(val)) {
                      setPhotoSpacing(Math.max(0, Math.min(50, val)));
                    }
                  }}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Рекомендуется: 5-10 мм
                </p>
              </div>
            )}
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