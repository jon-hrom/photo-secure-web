import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import type { PhotobookFormat, PhotoSlot, UploadedPhoto } from './PhotobookCreator';

interface PhotobookPreviewProps {
  format: PhotobookFormat;
  photoSlots: PhotoSlot[];
  photos: UploadedPhoto[];
  title: string;
  onTitleChange: (title: string) => void;
  enableClientLink: boolean;
  onEnableClientLinkChange: (enabled: boolean) => void;
  onComplete: () => void;
  onBack: () => void;
}

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

const fitPhotoToSlot = (
  photo: UploadedPhoto,
  slot: PhotoSlot
): { x: number; y: number; width: number; height: number } => {
  const photoAspect = photo.width / photo.height;
  const slotAspect = slot.width / slot.height;

  let width = slot.width;
  let height = slot.height;

  if (photoAspect > slotAspect) {
    width = slot.height * photoAspect;
  } else {
    height = slot.width / photoAspect;
  }

  const x = slot.x + (slot.width - width) / 2;
  const y = slot.y + (slot.height - height) / 2;

  return { x, y, width, height };
};

const adjustSlotToPhoto = (
  photo: UploadedPhoto,
  slot: PhotoSlot
): PhotoSlot => {
  const photoIsHorizontal = photo.width > photo.height;
  const photoAspect = photo.width / photo.height;
  
  if (photoIsHorizontal) {
    const newHeight = slot.width / photoAspect;
    const heightDiff = slot.height - newHeight;
    return {
      ...slot,
      y: slot.y + heightDiff / 2,
      height: newHeight,
      orientation: 'horizontal',
    };
  } else {
    const newWidth = slot.height * photoAspect;
    const widthDiff = slot.width - newWidth;
    return {
      ...slot,
      x: slot.x + widthDiff / 2,
      width: newWidth,
      orientation: 'vertical',
    };
  }
};

const PhotobookPreview = ({
  format,
  photoSlots,
  photos,
  title,
  onTitleChange,
  enableClientLink,
  onEnableClientLinkChange,
  onComplete,
  onBack,
}: PhotobookPreviewProps) => {
  const [currentSpread, setCurrentSpread] = useState(0);
  const dimensions = getFormatDimensions(format);

  const totalSpreads = Math.ceil(photos.length / photoSlots.length);
  const startPhotoIndex = currentSpread * photoSlots.length;
  const endPhotoIndex = Math.min(startPhotoIndex + photoSlots.length, photos.length);
  const spreadPhotos = photos.slice(startPhotoIndex, endPhotoIndex);

  const handlePrevSpread = () => {
    setCurrentSpread((prev) => Math.max(0, prev - 1));
  };

  const handleNextSpread = () => {
    setCurrentSpread((prev) => Math.min(totalSpreads - 1, prev + 1));
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">Просмотр фотокниги</h3>
        <p className="text-muted-foreground">
          Разворот {currentSpread + 1} из {totalSpreads}
        </p>
      </div>

      <Card className="border-2">
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="photobookTitle">Название фотокниги</Label>
            <Input
              id="photobookTitle"
              type="text"
              placeholder={`Фотокнига ${format.replace('x', '×')} см`}
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="mt-2"
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="enableClientLink"
                checked={enableClientLink}
                onCheckedChange={(checked) => onEnableClientLinkChange(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="enableClientLink" className="cursor-pointer">
                  Создать ссылку для клиента
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Клиент сможет просматривать макет и оставлять комментарии к каждому развороту
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevSpread}
              disabled={currentSpread === 0}
            >
              <Icon name="ChevronLeft" size={16} />
            </Button>
            <span className="text-sm font-medium px-4">
              Разворот {currentSpread + 1} / {totalSpreads}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextSpread}
              disabled={currentSpread === totalSpreads - 1}
            >
              <Icon name="ChevronRight" size={16} />
            </Button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
            <svg
              width={dimensions.width}
              height={dimensions.height}
              className="mx-auto border-2 border-gray-300"
              style={{ backgroundColor: 'white' }}
            >
              <defs>
                {spreadPhotos.map((photo, index) => {
                  const slot = photoSlots[index];
                  if (!slot) return null;

                  return (
                    <clipPath key={`clip-${index}`} id={`clip-${currentSpread}-${index}`}>
                      <rect
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        rx="4"
                      />
                    </clipPath>
                  );
                })}
              </defs>

              {photoSlots.map((slot, index) => {
                const photo = spreadPhotos[index];
                
                if (!photo) {
                  return (
                    <g key={`empty-${index}`}>
                      <rect
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        fill="#f3f4f6"
                        stroke="#d1d5db"
                        strokeWidth="2"
                        strokeDasharray="4"
                        rx="4"
                      />
                      <text
                        x={slot.x + slot.width / 2}
                        y={slot.y + slot.height / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#9ca3af"
                        fontSize="12"
                      >
                        {slot.orientation === 'horizontal' ? '📐 Гориз.' : '📏 Верт.'}
                      </text>
                    </g>
                  );
                }

                const adjustedSlot = adjustSlotToPhoto(photo, slot);

                return (
                  <g key={`photo-${index}`} className="animate-fade-in">
                    <rect
                      x={adjustedSlot.x}
                      y={adjustedSlot.y}
                      width={adjustedSlot.width}
                      height={adjustedSlot.height}
                      fill="#ffffff"
                      stroke="#9ca3af"
                      strokeWidth="1"
                      rx="4"
                    />
                    <image
                      href={photo.url}
                      x={adjustedSlot.x}
                      y={adjustedSlot.y}
                      width={adjustedSlot.width}
                      height={adjustedSlot.height}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon name="Info" size={16} />
                <span>Рамки автоматически подстраиваются под ориентацию фото, фото не обрезаются</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon name="CheckCircle" size={16} className="text-green-500" />
                <span>
                  Использовано {photos.length} {photos.length === 1 ? 'фотография' : 'фотографий'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-4">
        <Button variant="outline" onClick={onBack} className="rounded-full">
          <Icon name="ArrowLeft" size={18} className="mr-2" />
          Назад
        </Button>
        <Button onClick={onComplete} className="rounded-full bg-green-600 hover:bg-green-700">
          <Icon name="Check" size={18} className="mr-2" />
          Завершить создание
        </Button>
      </div>
    </div>
  );
};

export default PhotobookPreview;