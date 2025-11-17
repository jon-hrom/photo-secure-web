import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';
import type { PhotobookConfig, UploadedPhoto } from './PhotobookCreator';
import { getFormatDimensions } from './layoutUtils';
import { COLLAGES_1_PHOTO, COLLAGES_2_PHOTO, COLLAGES_3_PHOTO } from './collageTemplates';

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
  const canvasRef = useRef<SVGSVGElement>(null);
  
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
    
    const svg = canvasRef.current;
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
    
    const svg = canvasRef.current;
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
    
    const svg = canvasRef.current;
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
        {/* Левая панель - коллажи */}
        <Card className="w-64 p-4 flex flex-col">
          <h3 className="font-semibold mb-2">Коллажи</h3>
          
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">Количество фото</label>
            <Select
              value={photosPerCollage.toString()}
              onValueChange={(value) => setPhotosPerCollage(parseInt(value) as 1 | 2 | 3)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 фото в коллаже</SelectItem>
                <SelectItem value="2">2 фото в коллаже</SelectItem>
                <SelectItem value="3">3 фото в коллаже</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 gap-2">
              {collages.map((collage) => (
                <button
                  key={collage.id}
                  onClick={() => handleCollageSelect(collage.id)}
                  className={`border-2 rounded p-1 hover:border-purple-500 transition-colors ${
                    selectedSpread.collageId === collage.id ? 'border-purple-600 ring-2 ring-purple-200' : 'border-gray-200'
                  }`}
                >
                  <img src={collage.thumbnail} alt={`Коллаж ${collage.id}`} className="w-full h-auto" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Центральная часть - предпросмотр разворота */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevSpread}
              disabled={selectedSpreadIndex === 0}
            >
              <Icon name="ChevronLeft" size={20} />
            </Button>
            
            <span className="text-lg font-semibold">
              {selectedSpread.type === 'cover' ? 'Обложка' : `Разворот ${selectedSpreadIndex}`}
            </span>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextSpread}
              disabled={selectedSpreadIndex === spreads.length - 1}
            >
              <Icon name="ChevronRight" size={20} />
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg p-8">
            <svg
              ref={canvasRef}
              viewBox={`0 0 ${dimensions.width * 2} ${dimensions.height}`}
              className="max-w-full max-h-full border-2 border-gray-300 bg-white"
              style={{ aspectRatio: `${dimensions.width * 2} / ${dimensions.height}` }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <rect x={0} y={0} width={dimensions.width} height={dimensions.height} fill="#ffffff" />
              <rect x={dimensions.width} y={0} width={dimensions.width} height={dimensions.height} fill="#ffffff" />
              <rect
                x={spinePosition - spineWidth / 2}
                y={0}
                width={spineWidth}
                height={dimensions.height}
                fill="#e5e7eb"
              />

              {selectedSpread.slots.map((slot, idx) => {
                const isSelected = manualMode && selectedSlotIndex === idx;
                const photo = slot.photoId ? photos.find(p => p.id === slot.photoId) : null;
                
                return (
                  <g key={idx}>
                    {photo ? (
                      <image
                        href={photo.url}
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        preserveAspectRatio="xMidYMid slice"
                        style={{ cursor: manualMode ? 'move' : 'default' }}
                        onMouseDown={(e: any) => handleSlotMouseDown(e, idx)}
                      />
                    ) : (
                      <>
                        <rect
                          x={slot.x}
                          y={slot.y}
                          width={slot.width}
                          height={slot.height}
                          fill="#f3f4f6"
                          stroke={isSelected ? '#8b5cf6' : '#d1d5db'}
                          strokeWidth={isSelected ? '3' : '2'}
                          style={{ cursor: manualMode ? 'move' : 'default' }}
                          onMouseDown={(e: any) => handleSlotMouseDown(e, idx)}
                        />
                        <circle
                          cx={slot.x + slot.width / 2}
                          cy={slot.y + slot.height / 2}
                          r="20"
                          fill="#d1d5db"
                        />
                        <text
                          x={slot.x + slot.width / 2}
                          y={slot.y + slot.height / 2}
                          fontSize="24"
                          fill="#9ca3af"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          📷
                        </text>
                      </>
                    )}
                    
                    {isSelected && manualMode && (
                      <>
                        <circle cx={slot.x} cy={slot.y} r="6" fill="#8b5cf6" style={{ cursor: 'nwse-resize' }} onMouseDown={(e: any) => handleResizeMouseDown(e, idx, 'tl')} />
                        <circle cx={slot.x + slot.width} cy={slot.y} r="6" fill="#8b5cf6" style={{ cursor: 'nesw-resize' }} onMouseDown={(e: any) => handleResizeMouseDown(e, idx, 'tr')} />
                        <circle cx={slot.x} cy={slot.y + slot.height} r="6" fill="#8b5cf6" style={{ cursor: 'nesw-resize' }} onMouseDown={(e: any) => handleResizeMouseDown(e, idx, 'bl')} />
                        <circle cx={slot.x + slot.width} cy={slot.y + slot.height} r="6" fill="#8b5cf6" style={{ cursor: 'nwse-resize' }} onMouseDown={(e: any) => handleResizeMouseDown(e, idx, 'br')} />
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Менеджер разворотов */}
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="BookOpen" size={16} />
              <span className="text-sm font-semibold">Менеджер разворотов</span>
            </div>
            
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-2">
                {spreads.map((spread, idx) => (
                  <button
                    key={spread.id}
                    onClick={() => handleSpreadClick(idx)}
                    className={`flex-shrink-0 w-32 border-2 rounded p-2 transition-all ${
                      selectedSpreadIndex === idx
                        ? 'border-purple-600 ring-2 ring-purple-200 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <div className="aspect-video bg-gray-100 rounded mb-1 flex items-center justify-center">
                      <Icon name="LayoutTemplate" size={20} className="text-gray-400" />
                    </div>
                    <p className="text-xs text-center">
                      {spread.type === 'cover' ? 'Обложка' : `Разворот ${idx}`}
                    </p>
                  </button>
                ))}
                
                <button className="flex-shrink-0 w-32 border-2 border-dashed border-gray-300 rounded p-2 flex items-center justify-center hover:border-gray-400 transition-colors">
                  <Icon name="Plus" size={24} className="text-gray-400" />
                </button>
              </div>
            </ScrollArea>
          </div>
        </div>

        {manualMode && (
          <Card className="w-64 p-4 flex flex-col">
            <h3 className="font-semibold mb-2">Фотографии</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Кликните на фото, затем на слот чтобы применить
            </p>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => handlePhotoSelect(photo.id)}
                    className="border-2 rounded overflow-hidden hover:border-blue-500 transition-colors aspect-square"
                  >
                    <img 
                      src={photo.url} 
                      alt="Фото" 
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CollageBasedEditor;