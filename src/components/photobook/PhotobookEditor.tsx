import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import type { PhotobookData } from './PhotobookCreator';

interface PhotobookEditorProps {
  photobook: PhotobookData;
  onClose: () => void;
  onSave: (photobook: PhotobookData) => void;
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
  slot: { x: number; y: number; width: number; height: number }
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

const PhotobookEditor = ({ photobook, onClose, onSave }: PhotobookEditorProps) => {
  const dimensions = getFormatDimensions(photobook.format);
  const totalSpreads = Math.ceil(photobook.photos.length / photobook.photoSlots.length);

  const clientUrl = photobook.clientLinkId 
    ? `${window.location.origin}/client/photobook/${photobook.clientLinkId}` 
    : '';

  const handleCopyLink = () => {
    if (clientUrl) {
      navigator.clipboard.writeText(clientUrl);
      alert('Ссылка скопирована в буфер обмена!');
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Icon name="BookOpen" size={28} className="text-primary" />
            {photobook.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                <strong>Формат:</strong> {photobook.format.replace('x', '×')} см
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Фотографий:</strong> {photobook.photos.length}
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Разворотов:</strong> {totalSpreads}
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Расстояние между фото:</strong> {photobook.photoSpacing} мм
              </div>
            </div>

            {photobook.enableClientLink && (
              <div className="space-y-2">
                <Badge className="mb-2">
                  <Icon name="Link" size={14} className="mr-1" />
                  Ссылка для клиента активна
                </Badge>
                <div className="flex gap-2">
                  <Input value={clientUrl} readOnly className="text-xs" />
                  <Button onClick={handleCopyLink} size="sm">
                    <Icon name="Copy" size={16} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Клиент может просматривать макет и оставлять комментарии
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <h4 className="font-semibold mb-4">Предпросмотр макета</h4>
            
            <div className="space-y-6">
              {Array.from({ length: totalSpreads }, (_, spreadIndex) => {
                const startPhotoIndex = spreadIndex * photobook.photoSlots.length;
                const endPhotoIndex = Math.min(startPhotoIndex + photobook.photoSlots.length, photobook.photos.length);
                const spreadPhotos = photobook.photos.slice(startPhotoIndex, endPhotoIndex);

                return (
                  <div key={spreadIndex} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Разворот {spreadIndex + 1}</span>
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
                            const slot = photobook.photoSlots[index];
                            if (!slot) return null;

                            return (
                              <clipPath key={`clip-${spreadIndex}-${index}`} id={`clip-${spreadIndex}-${index}`}>
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

                        {photobook.photoSlots.map((slot, index) => {
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
                                clipPath={`url(#clip-${spreadIndex}-${index})`}
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
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="rounded-full">
              Закрыть
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotobookEditor;
