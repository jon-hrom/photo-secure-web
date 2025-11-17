import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { PhotobookConfig, UploadedPhoto } from './PhotobookCreator';
import { getFormatDimensions } from './layoutUtils';
import { COLLAGES_1_PHOTO, COLLAGES_2_PHOTO, COLLAGES_3_PHOTO } from './collageTemplates';
import CollageSelector from './CollageSelector';
import SpreadCanvas from './SpreadCanvas';
import PhotoPanel from './PhotoPanel';

interface CollageSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  photoId?: string;
}

interface CollageTemplate {
  id: string;
  slots: Omit<CollageSlot, 'photoId'>[];
  thumbnail: string;
}

interface Spread {
  id: string;
  type: 'cover' | 'spread';
  collageId: string;
  slots: CollageSlot[];
}

interface CollageBasedEditorProps {
  config: PhotobookConfig;
  photos: UploadedPhoto[];
  onComplete: (spreads: Array<{ id: string; slots: CollageSlot[] }>) => void;
  onBack: () => void;
}

const CollageBasedEditor = ({ config, photos, onComplete, onBack }: CollageBasedEditorProps) => {
  const [photosPerCollage, setPhotosPerCollage] = useState<1 | 2 | 3>(1);
  const [manualMode, setManualMode] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  
  const [spreads, setSpreads] = useState<Spread[]>(() => {
    const initialSpreads: Spread[] = [];
    initialSpreads.push({
      id: 'cover',
      type: 'cover',
      collageId: COLLAGES_1_PHOTO[0].id,
      slots: COLLAGES_1_PHOTO[0].slots.map(s => ({ ...s }))
    });
    
    for (let i = 0; i < config.spreadsCount; i++) {
      initialSpreads.push({
        id: `spread-${i}`,
        type: 'spread',
        collageId: COLLAGES_1_PHOTO[0].id,
        slots: COLLAGES_1_PHOTO[0].slots.map(s => ({ ...s }))
      });
    }
    
    return initialSpreads;
  });
  const [selectedSpreadIndex, setSelectedSpreadIndex] = useState(0);

  const dimensions = getFormatDimensions(config.format);
  const spinePosition = dimensions.width;
  const spineWidth = 10;

  const getCurrentCollages = (): CollageTemplate[] => {
    if (photosPerCollage === 1) return COLLAGES_1_PHOTO;
    if (photosPerCollage === 2) return COLLAGES_2_PHOTO;
    return COLLAGES_3_PHOTO;
  };

  const handleCollageSelect = (collageId: string) => {
    const collages = getCurrentCollages();
    const collage = collages.find(c => c.id === collageId);
    if (!collage) return;

    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        collageId,
        slots: collage.slots.map(s => ({ ...s }))
      };
    }));
  };

  const handlePrevSpread = () => {
    setSelectedSpreadIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextSpread = () => {
    setSelectedSpreadIndex(prev => Math.min(spreads.length - 1, prev + 1));
  };

  const handleSpreadClick = (index: number) => {
    setSelectedSpreadIndex(index);
  };

  const handleSlotMouseDown = (e: React.MouseEvent<SVGRectElement>, slotIndex: number) => {
    if (!manualMode) return;
    e.stopPropagation();
    
    setSelectedSlotIndex(slotIndex);
    setIsDragging(true);
    
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const scaleX = (dimensions.width * 2) / rect.width;
    const scaleY = dimensions.height / rect.height;
    
    setDragStart({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, slotIndex: number, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    if (!manualMode) return;
    e.stopPropagation();
    
    setSelectedSlotIndex(slotIndex);
    setIsResizing(true);
    setResizeCorner(corner);
    
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const scaleX = (dimensions.width * 2) / rect.width;
    const scaleY = dimensions.height / rect.height;
    
    setDragStart({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!manualMode || (!isDragging && !isResizing) || !dragStart) return;
    
    const svg = e.currentTarget;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const scaleX = (dimensions.width * 2) / rect.width;
    const scaleY = dimensions.height / rect.height;
    
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;
    
    const deltaX = currentX - dragStart.x;
    const deltaY = currentY - dragStart.y;
    
    if (isDragging && selectedSlotIndex !== null) {
      setSpreads(prev => prev.map((spread, idx) => {
        if (idx !== selectedSpreadIndex) return spread;
        
        return {
          ...spread,
          slots: spread.slots.map((slot, slotIdx) => {
            if (slotIdx !== selectedSlotIndex) return slot;
            
            const newX = Math.max(20, Math.min(slot.x + deltaX, dimensions.width * 2 - 20 - slot.width));
            const newY = Math.max(20, Math.min(slot.y + deltaY, dimensions.height - 20 - slot.height));
            
            return { ...slot, x: newX, y: newY };
          })
        };
      }));
    }
    
    if (isResizing && selectedSlotIndex !== null && resizeCorner) {
      setSpreads(prev => prev.map((spread, idx) => {
        if (idx !== selectedSpreadIndex) return spread;
        
        return {
          ...spread,
          slots: spread.slots.map((slot, slotIdx) => {
            if (slotIdx !== selectedSlotIndex) return slot;
            
            let newX = slot.x;
            let newY = slot.y;
            let newWidth = slot.width;
            let newHeight = slot.height;
            
            if (resizeCorner === 'br') {
              newWidth = Math.max(50, slot.width + deltaX);
              newHeight = Math.max(50, slot.height + deltaY);
            } else if (resizeCorner === 'bl') {
              newX = slot.x + deltaX;
              newWidth = Math.max(50, slot.width - deltaX);
              newHeight = Math.max(50, slot.height + deltaY);
            } else if (resizeCorner === 'tr') {
              newY = slot.y + deltaY;
              newWidth = Math.max(50, slot.width + deltaX);
              newHeight = Math.max(50, slot.height - deltaY);
            } else if (resizeCorner === 'tl') {
              newX = slot.x + deltaX;
              newY = slot.y + deltaY;
              newWidth = Math.max(50, slot.width - deltaX);
              newHeight = Math.max(50, slot.height - deltaY);
            }
            
            return { ...slot, x: newX, y: newY, width: newWidth, height: newHeight };
          })
        };
      }));
    }
    
    setDragStart({ x: currentX, y: currentY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeCorner(null);
    setDragStart(null);
  };

  const handlePhotoSelect = (photoId: string) => {
    if (!manualMode || selectedSlotIndex === null) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        slots: spread.slots.map((slot, slotIdx) => {
          if (slotIdx !== selectedSlotIndex) return slot;
          return { ...slot, photoId };
        })
      };
    }));
  };

  const handleDeleteSlot = () => {
    if (!manualMode || selectedSlotIndex === null) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        slots: spread.slots.filter((_, slotIdx) => slotIdx !== selectedSlotIndex)
      };
    }));
    
    setSelectedSlotIndex(null);
  };

  const handleAddSlot = () => {
    if (!manualMode) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        slots: [...spread.slots, {
          x: 100,
          y: 100,
          width: 200,
          height: 200
        }]
      };
    }));
  };

  const handleClearPhoto = () => {
    if (!manualMode || selectedSlotIndex === null) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        slots: spread.slots.map((slot, slotIdx) => {
          if (slotIdx !== selectedSlotIndex) return slot;
          return { ...slot, photoId: undefined };
        })
      };
    }));
  };

  const handleDuplicateSlot = () => {
    if (!manualMode || selectedSlotIndex === null) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      const slotToDuplicate = spread.slots[selectedSlotIndex];
      const newSlot = {
        ...slotToDuplicate,
        x: slotToDuplicate.x + 20,
        y: slotToDuplicate.y + 20
      };
      
      return {
        ...spread,
        slots: [...spread.slots, newSlot]
      };
    }));
  };

  const handleAutoFill = () => {
    let photoIndex = 0;
    
    setSpreads(prev => prev.map(spread => ({
      ...spread,
      slots: spread.slots.map(slot => {
        if (photoIndex < photos.length) {
          const photo = photos[photoIndex];
          photoIndex++;
          return { ...slot, photoId: photo.id };
        }
        return slot;
      })
    })));
  };

  const handleComplete = () => {
    onComplete(spreads.map(s => ({ id: s.id, slots: s.slots })));
  };

  const selectedSpread = spreads[selectedSpreadIndex];
  const collages = getCurrentCollages();

  return (
    <div className="h-[90vh] flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Редактор коллажей</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoFill}
          >
            <Icon name="Wand2" size={16} className="mr-1" />
            Автозаполнение
          </Button>
          <Button
            variant={manualMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setManualMode(!manualMode);
              setSelectedSlotIndex(null);
            }}
            className={manualMode ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            <Icon name={manualMode ? 'Unlock' : 'Lock'} size={16} className="mr-1" />
            {manualMode ? 'Ручной режим' : 'Ручной режим'}
          </Button>
        </div>
        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          onClick={handleComplete}
        >
          Завершить
        </Button>
      </div>
      
      {manualMode && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddSlot}
            >
              <Icon name="Plus" size={16} className="mr-1" />
              Добавить слот
            </Button>
            {selectedSlotIndex !== null && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicateSlot}
                >
                  <Icon name="Copy" size={16} className="mr-1" />
                  Дублировать
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearPhoto}
                >
                  <Icon name="X" size={16} className="mr-1" />
                  Очистить фото
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteSlot}
                  className="border-red-300 hover:bg-red-50"
                >
                  <Icon name="Trash2" size={16} className="mr-1" />
                  Удалить
                </Button>
              </>
            )}
          </div>
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 flex items-start gap-2">
            <Icon name="Info" size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>Инструкция:</strong> Кликните на слот для выбора → Перетаскивайте за центр → Изменяйте размер за фиолетовые углы → Выберите фото справа для применения
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-1 overflow-hidden">
        <CollageSelector
          photosPerCollage={photosPerCollage}
          onPhotosPerCollageChange={setPhotosPerCollage}
          collages={collages}
          selectedCollageId={selectedSpread.collageId}
          onCollageSelect={handleCollageSelect}
        />

        <SpreadCanvas
          spreads={spreads}
          selectedSpreadIndex={selectedSpreadIndex}
          photos={photos}
          dimensions={dimensions}
          spinePosition={spinePosition}
          spineWidth={spineWidth}
          manualMode={manualMode}
          selectedSlotIndex={selectedSlotIndex}
          onPrevSpread={handlePrevSpread}
          onNextSpread={handleNextSpread}
          onSpreadClick={handleSpreadClick}
          onSlotMouseDown={handleSlotMouseDown}
          onResizeMouseDown={handleResizeMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />

        {manualMode && (
          <PhotoPanel
            photos={photos}
            onPhotoSelect={handlePhotoSelect}
          />
        )}
      </div>
    </div>
  );
};

export default CollageBasedEditor;
