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

const fitPhotoToSlot = (
  photo: { width: number; height: number },
  slot: PhotoSlot
): { x: number; y: number; width: number; height: number } => {
  const photoAspect = photo.width / photo.height;
  const slotAspect = slot.width / slot.height;

  let width = slot.width;
  let height = slot.height;

  if (photoAspect > slotAspect) {
    height = slot.width / photoAspect;
  } else {
    width = slot.height * photoAspect;
  }

  const x = slot.x + (slot.width - width) / 2;
  const y = slot.y + (slot.height - height) / 2;

  return { x, y, width, height };
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">{mockPhotobook.title}</h1>
          <p className="text-muted-foreground">
            Просмотр макета фотокниги
          </p>
          <Badge className="mt-2">
            <Icon name="Eye" size={14} className="mr-1" />
            Режим просмотра клиента
          </Badge>
        </div>

        <Card className="border-2 shadow-xl">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevSpread}
                disabled={currentSpread === 0}
              >
                <Icon name="ChevronLeft" size={18} />
              </Button>
              <div className="text-center">
                <div className="text-sm font-medium">
                  Разворот {currentSpread + 1} из {totalSpreads}
                </div>
                <div className="text-xs text-muted-foreground">
                  Формат: {mockPhotobook.format.replace('x', '×')} см
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextSpread}
                disabled={currentSpread === totalSpreads - 1}
              >
                <Icon name="ChevronRight" size={18} />
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
                      <rect
                        key={`empty-${index}`}
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        fill="#f3f4f6"
                        stroke="#d1d5db"
                        strokeWidth="2"
                        rx="4"
                      />
                    );
                  }

                  const fitted = fitPhotoToSlot(photo, slot);

                  return (
                    <g key={`photo-${index}`}>
                      <rect
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        fill="#e5e7eb"
                        rx="4"
                      />
                      <image
                        href={photo.url}
                        x={fitted.x}
                        y={fitted.y}
                        width={fitted.width}
                        height={fitted.height}
                        clipPath={`url(#clip-${currentSpread}-${index})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                      <rect
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="1"
                        rx="4"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Icon name="MessageSquare" size={20} className="text-primary" />
              <h3 className="font-semibold">Комментарий к развороту {currentSpread + 1}</h3>
            </div>
            
            <Textarea
              placeholder="Напишите ваш комментарий или пожелания к этому развороту..."
              value={comments[currentSpread] || ''}
              onChange={(e) => handleCommentChange(currentSpread, e.target.value)}
              rows={4}
              className="resize-none"
            />

            <Button 
              onClick={() => handleSaveComment(currentSpread)}
              className="w-full rounded-full"
              disabled={!comments[currentSpread]?.trim()}
            >
              <Icon name="Send" size={18} className="mr-2" />
              Отправить комментарий
            </Button>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="Info" size={16} />
              <span>Ваши комментарии будут отправлены фотографу</span>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Создано с помощью сервиса фотокниг</p>
        </div>
      </div>
    </div>
  );
};

export default ClientPhotobookView;
