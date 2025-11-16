import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PhotobookConfig, UploadedPhoto, PhotoSlot } from '../PhotobookCreator';

interface Spread {
  id: string;
  type: 'cover' | 'spread';
  slots: PhotoSlot[];
}

interface PhotobookEditorAdvancedProps {
  config: PhotobookConfig;
  photos: UploadedPhoto[];
  onComplete: (spreads: Spread[]) => void;
  onBack: () => void;
}

interface DraggablePhoto {
  slotId: string;
  photoId: string;
  scale: number;
  offsetX: number;
  offsetY: number;
}

const PhotobookEditorAdvanced = ({ config, photos, onComplete, onBack }: PhotobookEditorAdvancedProps) => {
  const [spreads, setSpreads] = useState<Spread[]>([
    {
      id: 'cover',
      type: 'cover',
      slots: [
        { id: 'cover-slot', orientation: 'horizontal', x: 50, y: 50, width: 700, height: 500, photoId: photos[0]?.id }
      ]
    },
    {
      id: 'spread-1',
      type: 'spread',
      slots: [
        { id: 's1-slot1', orientation: 'horizontal', x: 20, y: 20, width: 380, height: 280, photoId: photos[1]?.id },
        { id: 's1-slot2', orientation: 'vertical', x: 420, y: 20, width: 180, height: 280, photoId: photos[2]?.id },
        { id: 's1-slot3', orientation: 'horizontal', x: 620, y: 20, width: 380, height: 280, photoId: photos[3]?.id },
      ]
    },
    {
      id: 'spread-2',
      type: 'spread',
      slots: [
        { id: 's2-slot1', orientation: 'horizontal', x: 20, y: 20, width: 480, height: 360 },
        { id: 's2-slot2', orientation: 'horizontal', x: 520, y: 20, width: 480, height: 360 },
      ]
    },
  ]);

  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [photoAdjustments, setPhotoAdjustments] = useState<Record<string, DraggablePhoto>>({});
  const [leftPanelTab, setLeftPanelTab] = useState<'photos' | 'text' | 'templates' | 'bg' | 'collages' | 'stickers' | 'frames'>('photos');

  const currentSpread = spreads[currentSpreadIndex];

  const handleAddPhotoToSlot = (slotId: string, photoId: string) => {
    setSpreads(prev => prev.map(spread => ({
      ...spread,
      slots: spread.slots.map(slot =>
        slot.id === slotId ? { ...slot, photoId } : slot
      )
    })));
  };

  const handleRemovePhotoFromSlot = (slotId: string) => {
    setSpreads(prev => prev.map(spread => ({
      ...spread,
      slots: spread.slots.map(slot =>
        slot.id === slotId ? { ...slot, photoId: undefined } : slot
      )
    })));
  };

  const handleComplete = () => {
    onComplete(spreads);
  };

  const getPhotoForSlot = (slotId: string) => {
    const slot = currentSpread.slots.find(s => s.id === slotId);
    if (!slot?.photoId) return null;
    return photos.find(p => p.id === slot.photoId);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top toolbar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-yellow-400 rounded flex items-center justify-center">
              <Icon name="Camera" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Фотокниги на фотобумаге</p>
              <p className="text-sm font-semibold">
                20x20 Фотокнига (1-40р) без прослойки
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm">
            <Icon name="Undo" size={18} className="mr-2" />
          </Button>
          <Button variant="ghost" size="sm">
            <Icon name="Redo" size={18} className="mr-2" />
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <Button variant="outline" size="sm">
            <Icon name="Eye" size={18} className="mr-2" />
            Предпросмотр
          </Button>
          <Button variant="outline" size="sm">
            <Icon name="Save" size={18} className="mr-2" />
            Сохранить
          </Button>
          <Button
            size="sm"
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          >
            Заказать за {config.price.toLocaleString('ru-RU')} ₽
          </Button>
          <Button variant="ghost" size="sm">
            <Icon name="Settings" size={18} />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Tools */}
        <div className="w-16 bg-white border-r flex flex-col items-center py-4 gap-4">
          <Button
            variant={leftPanelTab === 'photos' ? 'default' : 'ghost'}
            size="icon"
            className="w-12 h-12 flex flex-col gap-1 text-xs"
            onClick={() => setLeftPanelTab('photos')}
          >
            <Icon name="Image" size={20} />
          </Button>
          <Button
            variant={leftPanelTab === 'text' ? 'default' : 'ghost'}
            size="icon"
            className="w-12 h-12 flex flex-col gap-1 text-xs"
            onClick={() => setLeftPanelTab('text')}
          >
            <Icon name="Type" size={20} />
          </Button>
          <Button
            variant={leftPanelTab === 'templates' ? 'default' : 'ghost'}
            size="icon"
            className="w-12 h-12 flex flex-col gap-1 text-xs"
            onClick={() => setLeftPanelTab('templates')}
          >
            <Icon name="Layout" size={20} />
          </Button>
          <Button
            variant={leftPanelTab === 'bg' ? 'default' : 'ghost'}
            size="icon"
            className="w-12 h-12 flex flex-col gap-1 text-xs"
            onClick={() => setLeftPanelTab('bg')}
          >
            <Icon name="Palette" size={20} />
          </Button>
          <Button
            variant={leftPanelTab === 'collages' ? 'default' : 'ghost'}
            size="icon"
            className="w-12 h-12 flex flex-col gap-1 text-xs"
            onClick={() => setLeftPanelTab('collages')}
          >
            <Icon name="Grid3x3" size={20} />
          </Button>
          <Button
            variant={leftPanelTab === 'stickers' ? 'default' : 'ghost'}
            size="icon"
            className="w-12 h-12 flex flex-col gap-1 text-xs"
            onClick={() => setLeftPanelTab('stickers')}
          >
            <Icon name="Smile" size={20} />
          </Button>
          <Button
            variant={leftPanelTab === 'frames' ? 'default' : 'ghost'}
            size="icon"
            className="w-12 h-12 flex flex-col gap-1 text-xs"
            onClick={() => setLeftPanelTab('frames')}
          >
            <Icon name="Frame" size={20} />
          </Button>
        </div>

        {/* Left panel - Content */}
        <div className="w-80 bg-white border-r flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Icon name="Image" size={20} />
              Фото
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {leftPanelTab === 'photos' && (
              <div className="space-y-4">
                <Button variant="outline" className="w-full">
                  <Icon name="Plus" size={18} className="mr-2" />
                  Добавить фото
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative group cursor-move"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('photoId', photo.id);
                      }}
                    >
                      <img
                        src={photo.url}
                        alt="Photo"
                        className="w-full aspect-square object-cover rounded border-2 border-gray-200 hover:border-blue-400 transition-colors"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <Icon name="GripVertical" size={24} className="text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leftPanelTab === 'text' && (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="Type" size={48} className="mx-auto mb-2" />
                <p>Добавление текста</p>
              </div>
            )}

            {leftPanelTab === 'templates' && (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="Layout" size={48} className="mx-auto mb-2" />
                <p>Шаблоны коллажей</p>
              </div>
            )}
          </div>
        </div>

        {/* Main canvas */}
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
                  onClick={() => setCurrentSpreadIndex(prev => Math.max(0, prev - 1))}
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
                  onClick={() => setCurrentSpreadIndex(prev => Math.min(spreads.length - 1, prev + 1))}
                  disabled={currentSpreadIndex === spreads.length - 1}
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
                      onClick={() => setSelectedSlot(slot.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const photoId = e.dataTransfer.getData('photoId');
                        if (photoId) {
                          handleAddPhotoToSlot(slot.id, photoId);
                        }
                      }}
                    >
                      {photo ? (
                        <div className="relative w-full h-full overflow-hidden group">
                          <img
                            src={photo.url}
                            alt="Slot"
                            className="w-full h-full object-cover"
                          />
                          {selectedSlot === slot.id && (
                            <div className="absolute inset-0 border-2 border-blue-500">
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2">
                                <Button size="icon" variant="secondary" className="w-8 h-8">
                                  <Icon name="Move" size={16} />
                                </Button>
                                <Button size="icon" variant="secondary" className="w-8 h-8">
                                  <Icon name="ZoomIn" size={16} />
                                </Button>
                              </div>
                            </div>
                          )}
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhotoFromSlot(slot.id);
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

          {/* Bottom thumbnails */}
          <div className="bg-white border-t p-4">
            <div className="flex items-center gap-2 overflow-x-auto">
              <Button variant="outline" size="sm">
                <Icon name="Download" size={16} className="mr-2" />
                Менеджер разворотов
              </Button>
              {spreads.map((spread, index) => (
                <Card
                  key={spread.id}
                  className={`flex-shrink-0 w-32 cursor-pointer transition-all ${
                    currentSpreadIndex === index ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setCurrentSpreadIndex(index)}
                >
                  <div className="aspect-[5/3] bg-gray-100 p-2 flex items-center justify-center">
                    <Icon name="BookOpen" size={32} className="text-gray-400" />
                  </div>
                  <p className="text-xs text-center py-1 border-t">
                    {spread.type === 'cover' ? 'Обложка' : `Разворот ${index}`}
                  </p>
                </Card>
              ))}
              <Card className="flex-shrink-0 w-32 cursor-pointer border-dashed hover:bg-gray-50">
                <div className="aspect-[5/3] bg-gray-50 flex items-center justify-center">
                  <Icon name="Plus" size={32} className="text-gray-400" />
                </div>
                <p className="text-xs text-center py-1">Разворот 4</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotobookEditorAdvanced;
