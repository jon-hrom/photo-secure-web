import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface FormatSpecs {
  width: number;
  height: number;
  spreadMM: string;
  spreadPX: string;
  coverMM: string;
  coverPX: string;
  spineMM: string;
  spinePX: string;
  spreadsRange: string;
}

const SPREAD_SPECS_20x20 = [
  { range: '10-60', spreads: '10-13', spread: '400×203 мм (4724×2398 px)', cover: '457×240 мм (5390×2835 px)', spine: '8 мм (94 px)' },
  { range: '10-60', spreads: '14-17', spread: '400×203 мм (4724×2398 px)', cover: '458×240 мм (5402×2835 px)', spine: '9 мм (106 px)' },
  { range: '10-60', spreads: '18-21', spread: '400×203 мм (4724×2398 px)', cover: '461×240 мм (5445×2835 px)', spine: '12 мм (142 px)' },
  { range: '10-60', spreads: '22-25', spread: '400×203 мм (4724×2398 px)', cover: '463×240 мм (5469×2835 px)', spine: '14 мм (165 px)' },
];

const FORMAT_SPECS: Record<PhotobookFormat, FormatSpecs> = {
  '20x20': {
    width: 400,
    height: 200,
    spreadMM: '400×203',
    spreadPX: '4724×2398',
    coverMM: '457-463×240',
    coverPX: '5390-5469×2835',
    spineMM: '8-14',
    spinePX: '94-165',
    spreadsRange: 'от 10 до 25'
  },
  '21x30': {
    width: 420,
    height: 300,
    spreadMM: '420×300',
    spreadPX: '4961×3543',
    coverMM: '477×330',
    coverPX: '5634×3898',
    spineMM: '10',
    spinePX: '118',
    spreadsRange: 'стандарт'
  },
  '30x30': {
    width: 600,
    height: 300,
    spreadMM: '600×300',
    spreadPX: '7087×3543',
    coverMM: '657×330',
    coverPX: '7756×3898',
    spineMM: '12',
    spinePX: '142',
    spreadsRange: 'большой'
  }
};

const getFormatDimensions = (format: PhotobookFormat): { width: number; height: number } => {
  return FORMAT_SPECS[format];
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
  const [photosInputValue, setPhotosInputValue] = useState(String(photosPerSpread));
  const [spacingInputValue, setSpacingInputValue] = useState(String(photoSpacing));
  const [showSpecsDialog, setShowSpecsDialog] = useState(false);
  
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-start justify-between">
              <div className="text-sm space-y-1 flex-1">
                <div className="font-semibold text-blue-900">Размеры для типографии (формат {format}):</div>
                <div className="grid grid-cols-2 gap-x-4 text-blue-800">
                  <div>• Разворот: {FORMAT_SPECS[format].spreadMM} мм ({FORMAT_SPECS[format].spreadPX} px)</div>
                  <div>• Обложка: {FORMAT_SPECS[format].coverMM} мм ({FORMAT_SPECS[format].coverPX} px)</div>
                  <div>• Корешок: {FORMAT_SPECS[format].spineMM} мм ({FORMAT_SPECS[format].spinePX} px)</div>
                  <div>• Количество разворотов: {FORMAT_SPECS[format].spreadsRange}</div>
                </div>
              </div>
              {format === '20x20' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSpecsDialog(true)}
                  className="text-blue-700 hover:text-blue-900"
                >
                  <Icon name="Info" size={18} className="mr-1" />
                  Детали
                </Button>
              )}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="photosCount">Количество фото на развороте</Label>
              <Input
                id="photosCount"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={photosInputValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPhotosInputValue(val);
                  
                  if (val === '') {
                    return;
                  }
                  
                  const num = parseInt(val);
                  if (!isNaN(num)) {
                    const clamped = Math.max(0, Math.min(20, num));
                    onPhotosPerSpreadChange(clamped);
                  }
                }}
                onBlur={() => {
                  if (photosInputValue === '') {
                    setPhotosInputValue('4');
                    onPhotosPerSpreadChange(4);
                  }
                }}
                placeholder="От 0 до 20"
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={spacingInputValue}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setSpacingInputValue(val);
                    
                    if (val === '') {
                      return;
                    }
                    
                    const num = parseInt(val);
                    if (!isNaN(num)) {
                      const clamped = Math.max(0, Math.min(50, num));
                      setPhotoSpacing(clamped);
                    }
                  }}
                  onBlur={() => {
                    if (spacingInputValue === '') {
                      setSpacingInputValue('5');
                      setPhotoSpacing(5);
                    }
                  }}
                  placeholder="От 0 до 50"
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

      <Dialog open={showSpecsDialog} onOpenChange={setShowSpecsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детальные размеры макетов 20×20 см для типографии</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground mb-4">
              Размеры разворота, обложки и корешка в зависимости от количества разворотов
            </div>
            <div className="space-y-3">
              {SPREAD_SPECS_20x20.map((spec, index) => (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="font-semibold text-primary mb-2">
                      Развороты: {spec.spreads}
                    </div>
                    <div className="grid md:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Разворот:</span>
                        <div className="text-muted-foreground">{spec.spread}</div>
                      </div>
                      <div>
                        <span className="font-medium">Обложка:</span>
                        <div className="text-muted-foreground">{spec.cover}</div>
                      </div>
                      <div>
                        <span className="font-medium">Корешок:</span>
                        <div className="text-muted-foreground">{spec.spine}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
              <div className="flex items-start gap-2">
                <Icon name="AlertTriangle" size={18} className="text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Важно:</strong> Данные для разворотов от 26 до 40 будут добавлены позже. 
                  Используйте указанные размеры для точной подготовки макетов в типографию.
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotobookLayoutDesigner;