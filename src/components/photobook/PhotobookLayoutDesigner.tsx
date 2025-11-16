import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import type { PhotobookFormat, PhotoSlot } from './PhotobookCreator';
import { 
  SAFE_MARGIN, 
  DEFAULT_PHOTO_SPACING, 
  getFormatDimensions, 
  generateLayout, 
  generateRandomLayout 
} from './layoutUtils';
import FormatSpecsInfo from './FormatSpecsInfo';
import LayoutPreview from './LayoutPreview';

interface PhotobookLayoutDesignerProps {
  format: PhotobookFormat;
  photosPerSpread: number;
  onPhotosPerSpreadChange: (count: number) => void;
  onConfirm: (slots: PhotoSlot[], photoSpacing: number) => void;
  onBack: () => void;
}

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
          <FormatSpecsInfo format={format} />
          
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

      <LayoutPreview
        dimensions={dimensions}
        photoSlots={photoSlots}
        layoutVariant={layoutVariant}
        onNextVariant={handleNextVariant}
        onPrevVariant={handlePrevVariant}
      />

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
