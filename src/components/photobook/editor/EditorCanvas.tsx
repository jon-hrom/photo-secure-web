import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { PhotoSlot, UploadedPhoto } from '../PhotobookCreator';
import PhotoToolbar from '../PhotoToolbar';

interface Spread {
  id: string;
  type: 'cover' | 'spread';
  slots: PhotoSlot[];
}

interface DraggablePhoto {
  slotId: string;
  photoId: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  opacity?: number;
  filter?: string;
  frameId?: string | null;
}

interface EditorCanvasProps {
  currentSpread: Spread;
  currentSpreadIndex: number;
  spreadsLength: number;
  selectedSlot: string | null;
  photos: UploadedPhoto[];
  photoAdjustments: Record<string, DraggablePhoto>;
  onSpreadChange: (index: number) => void;
  onSlotSelect: (slotId: string) => void;
  onAddPhotoToSlot: (slotId: string, photoId: string) => void;
  onRemovePhotoFromSlot: (slotId: string) => void;
  onToolFrame: () => void;
  onToolReplace: () => void;
  onToolCrop: () => void;
  onToolTransparency: () => void;
  onToolMakeBackground: () => void;
  onToolClear: () => void;
  onToolStyle: () => void;
}

const EditorCanvas = ({
  currentSpread,
  currentSpreadIndex,
  spreadsLength,
  selectedSlot,
  photos,
  photoAdjustments,
  onSpreadChange,
  onSlotSelect,
  onAddPhotoToSlot,
  onRemovePhotoFromSlot,
  onToolFrame,
  onToolReplace,
  onToolCrop,
  onToolTransparency,
  onToolMakeBackground,
  onToolClear,
  onToolStyle,
}: EditorCanvasProps) => {
  const getPhotoForSlot = (slotId: string) => {
    const slot = currentSpread.slots.find(s => s.id === slotId);
    if (!slot?.photoId) return null;
    return photos.find(p => p.id === slot.photoId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Ruler */}
      <div className="h-6 bg-gray-100 border-b flex items-center px-4 text-xs text-muted-foreground">
        <div className="flex-1 flex justify-between">
          {Array.from({ length: 21 }).map((_, i) => (
            <span key={i}>{i * 100}</span>
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto bg-gray-200 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onSpreadChange(Math.max(0, currentSpreadIndex - 1))}
              disabled={currentSpreadIndex === 0}
            >
              <Icon name="ChevronLeft" size={20} />
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm">
              <Icon name="BookOpen" size={18} />
              <span className="font-semibold">
                {currentSpread.type === 'cover' ? 'Обложка' : `Разворот ${currentSpreadIndex}`}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onSpreadChange(Math.min(spreadsLength - 1, currentSpreadIndex + 1))}
              disabled={currentSpreadIndex === spreadsLength - 1}
            >
              <Icon name="ChevronRight" size={20} />
            </Button>
          </div>

          {/* Spread canvas */}
          <div className="relative bg-white shadow-2xl" style={{ width: '1000px', height: '600px' }}>
            {/* Safety lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-2 left-2 right-2 bottom-2 border-2 border-dashed border-gray-300" />
              {currentSpread.type === 'spread' && (
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-red-500 opacity-50" />
              )}
            </div>

            {/* Photo slots */}
            {currentSpread.slots.map((slot) => {
              const photo = getPhotoForSlot(slot.id);
              return (
                <div
                  key={slot.id}
                  className={`absolute border-2 ${selectedSlot === slot.id ? 'border-blue-500' : 'border-gray-400'} ${!photo ? 'border-dashed' : ''}`}
                  style={{
                    left: `${slot.x}px`,
                    top: `${slot.y}px`,
                    width: `${slot.width}px`,
                    height: `${slot.height}px`,
                  }}
                  onClick={() => onSlotSelect(slot.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const photoId = e.dataTransfer.getData('photoId');
                    if (photoId) {
                      onAddPhotoToSlot(slot.id, photoId);
                    }
                  }}
                >
                  {photo ? (
                    <div className="relative w-full h-full overflow-hidden group">
                      <img
                        src={photo.url}
                        alt="Slot"
                        className="w-full h-full object-cover"
                        style={{
                          opacity: photoAdjustments[slot.id]?.opacity ?? 1,
                          filter: photoAdjustments[slot.id]?.filter ?? 'none',
                          transform: `scale(${photoAdjustments[slot.id]?.scale ?? 1})`
                        }}
                      />
                      {selectedSlot === slot.id && (
                        <>
                          <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />
                          <PhotoToolbar
                            onFrame={onToolFrame}
                            onReplace={onToolReplace}
                            onCrop={onToolCrop}
                            onTransparency={onToolTransparency}
                            onMakeBackground={onToolMakeBackground}
                            onClear={onToolClear}
                            onStyle={onToolStyle}
                          />
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemovePhotoFromSlot(slot.id);
                        }}
                      >
                        <Icon name="X" size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Icon name="ImagePlus" size={48} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Spread label */}
          <div className="text-center mt-4 text-sm text-muted-foreground">
            {currentSpread.type === 'cover' ? 'Линия загиба' : `${currentSpread.type === 'spread' ? 'Оборотная сторона / Лицевая сторона' : ''}`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorCanvas;
