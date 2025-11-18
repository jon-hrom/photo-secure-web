import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface PhotoSlot {
  id: string;
  orientation: 'horizontal' | 'vertical';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UploadedPhoto {
  id: string;
  url: string;
  width: number;
  height: number;
}

interface ClientPhotobookViewProps {
  clientLinkId: string;
}

const getFormatDimensions = (format: string): { width: number; height: number } => {
  switch (format) {
    case '20x20':
      return { width: 400, height: 200 };
    case '21x30':
      return { width: 420, height: 300 };
    case '30x30':
      return { width: 600, height: 300 };
    default:
      return { width: 400, height: 200 };
  }
};

const adjustSlotToPhoto = (
  photo: { width: number; height: number },
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

const ClientPhotobookView = ({ clientLinkId }: ClientPhotobookViewProps) => {
  const [currentSpread, setCurrentSpread] = useState(0);
  const [comments, setComments] = useState<{ [spreadIndex: number]: string }>({});

  const mockPhotobook = {
    id: clientLinkId,
    title: 'Фотокнига для просмотра',
    format: '20x20' as const,
    photosPerSpread: 4,
    photoSlots: [
      { id: 'slot-0', orientation: 'horizontal' as const, x: 10, y: 10, width: 180, height: 85 },
      { id: 'slot-1', orientation: 'horizontal' as const, x: 200, y: 10, width: 180, height: 85 },
      { id: 'slot-2', orientation: 'horizontal' as const, x: 10, y: 105, width: 180, height: 85 },
      { id: 'slot-3', orientation: 'horizontal' as const, x: 200, y: 105, width: 180, height: 85 },
    ] as PhotoSlot[],
    photos: [] as UploadedPhoto[],
  };

  const dimensions = getFormatDimensions(mockPhotobook.format);
  const totalSpreads = Math.max(1, Math.ceil(mockPhotobook.photos.length / mockPhotobook.photoSlots.length));

  const handleCommentChange = (spreadIndex: number, comment: string) => {
    setComments(prev => ({ ...prev, [spreadIndex]: comment }));
  };

  const handleSaveComment = (spreadIndex: number) => {
    const comment = comments[spreadIndex];
    console.log(`Комментарий к развороту ${spreadIndex + 1}:`, comment);
    alert('Комментарий сохранён! Фотограф получит уведомление.');
  };

  const handlePrevSpread = () => {
    setCurrentSpread(prev => Math.max(0, prev - 1));
  };

  const handleNextSpread = () => {
    setCurrentSpread(prev => Math.min(totalSpreads - 1, prev + 1));
  };

  const startPhotoIndex = currentSpread * mockPhotobook.photoSlots.length;
  const endPhotoIndex = Math.min(startPhotoIndex + mockPhotobook.photoSlots.length, mockPhotobook.photos.length);
  const spreadPhotos = mockPhotobook.photos.slice(startPhotoIndex, endPhotoIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-2 sm:p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-3 sm:space-y-6">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 md:mb-2">{mockPhotobook.title}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Просмотр макета фотокниги
          </p>
          <Badge className="mt-1 md:mt-2 text-xs">
            <Icon name="Eye" size={12} className="mr-1" />
            Режим просмотра клиента
          </Badge>
        </div>

        <Card className="border-2 shadow-xl">
          <CardContent className="p-2 sm:p-4 md:p-6">
            <div className="mb-2 md:mb-4 flex items-center justify-center gap-2 md:gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevSpread}
                disabled={currentSpread === 0}
                className="h-8 w-8 md:h-9 md:w-9 p-0"
              >
                <Icon name="ChevronLeft" size={16} />
              </Button>
              <div className="text-center flex-1">
                <div className="text-xs sm:text-sm font-medium">
                  Разворот {currentSpread + 1} из {totalSpreads}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">
                  Формат: {mockPhotobook.format.replace('x', '×')} см
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextSpread}
                disabled={currentSpread === totalSpreads - 1}
                className="h-8 w-8 md:h-9 md:w-9 p-0"
              >
                <Icon name="ChevronRight" size={16} />
              </Button>
            </div>

            <div className="bg-gray-50 rounded-lg p-1 md:p-4 overflow-hidden">
              <div className="w-full overflow-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                <svg
                  viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                  className="mx-auto border border-gray-300 w-full h-auto"
                  style={{ backgroundColor: 'white', maxWidth: '100%' }}
                  preserveAspectRatio="xMidYMid meet"
                >
                <defs>
                  {spreadPhotos.map((photo, index) => {
                    const slot = mockPhotobook.photoSlots[index];
                    if (!slot) return null;

                    return (
                      <clipPath key={`clip-${currentSpread}-${index}`} id={`clip-${currentSpread}-${index}`}>
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

                {mockPhotobook.photoSlots.map((slot, index) => {
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
                    <g key={`photo-${index}`}>
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
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg">
          <CardContent className="p-2 sm:p-4 md:p-6 space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <Icon name="MessageSquare" size={16} className="text-primary" />
              <h3 className="text-sm sm:text-base font-semibold">Комментарий к развороту {currentSpread + 1}</h3>
            </div>
            
            <Textarea
              placeholder="Напишите ваш комментарий или пожелания к этому развороту..."
              value={comments[currentSpread] || ''}
              onChange={(e) => handleCommentChange(currentSpread, e.target.value)}
              rows={3}
              className="resize-none text-xs sm:text-sm"
            />

            <Button 
              onClick={() => handleSaveComment(currentSpread)}
              className="w-full rounded-full text-xs sm:text-sm"
              size="sm"
              disabled={!comments[currentSpread]?.trim()}
            >
              <Icon name="Send" size={14} className="mr-2" />
              Отправить комментарий
            </Button>

            <div className="flex items-center gap-2 text-[10px] sm:text-xs md:text-sm text-muted-foreground">
              <Icon name="Info" size={14} />
              <span>Ваши комментарии будут отправлены фотографу</span>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs sm:text-sm text-muted-foreground">
          <p>Создано с помощью сервиса фотокниг</p>
        </div>
      </div>
    </div>
  );
};

export default ClientPhotobookView;