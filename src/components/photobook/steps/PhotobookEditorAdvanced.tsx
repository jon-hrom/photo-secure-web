import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PhotobookConfig, UploadedPhoto, PhotoSlot } from '../PhotobookCreator';
import PhotoToolbar from '../PhotoToolbar';
import FrameSelector from '../FrameSelector';
import CropTool from '../CropTool';
import TransparencyTool from '../TransparencyTool';
import StyleSelector from '../StyleSelector';
import HistoryPanel from '../HistoryPanel';
import { Input } from '@/components/ui/input';
import { useUndoRedo } from '@/hooks/useUndoRedo';

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
  opacity?: number;
  filter?: string;
  frameId?: string | null;
}

const PhotobookEditorAdvanced = ({ config, photos, onComplete, onBack }: PhotobookEditorAdvancedProps) => {
  const initialSpreads: Spread[] = [
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
  ];

  const {
    state: spreads,
    setState: setSpreads,
    undo,
    redo,
    canUndo,
    canRedo,
    historySize,
    currentIndex,
  } = useUndoRedo<Spread[]>(initialSpreads, 100);

  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [photoAdjustments, setPhotoAdjustments] = useState<Record<string, DraggablePhoto>>({});
  const [leftPanelTab, setLeftPanelTab] = useState<'photos' | 'text' | 'templates' | 'bg' | 'collages' | 'stickers' | 'frames'>('photos');
  
  const [showFrameSelector, setShowFrameSelector] = useState(false);
  const [showCropTool, setShowCropTool] = useState(false);
  const [showTransparencyTool, setShowTransparencyTool] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [textToAdd, setTextToAdd] = useState('');

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || 
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleComplete = () => {
    onComplete(spreads);
  };

  const getPhotoForSlot = (slotId: string) => {
    const slot = currentSpread.slots.find(s => s.id === slotId);
    if (!slot?.photoId) return null;
    return photos.find(p => p.id === slot.photoId);
  };

  const handleToolFrame = () => {
    if (selectedSlot) {
      setShowFrameSelector(true);
    }
  };

  const handleToolCrop = () => {
    if (selectedSlot) {
      setShowCropTool(true);
    }
  };

  const handleToolTransparency = () => {
    if (selectedSlot) {
      setShowTransparencyTool(true);
    }
  };

  const handleToolStyle = () => {
    if (selectedSlot) {
      setShowStyleSelector(true);
    }
  };

  const handleToolReplace = () => {
    if (selectedSlot) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const newPhoto: UploadedPhoto = {
              id: `photo-${Date.now()}`,
              url: e.target?.result as string,
              file: file,
              width: 800,
              height: 600
            };
            handleAddPhotoToSlot(selectedSlot, newPhoto.id);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const handleToolMakeBackground = () => {
    if (selectedSlot) {
      const photo = getPhotoForSlot(selectedSlot);
      if (photo) {
        console.log('Making background from', photo.id);
      }
    }
  };

  const handleToolClear = () => {
    if (selectedSlot) {
      handleRemovePhotoFromSlot(selectedSlot);
    }
  };

  const handleApplyFrame = (frameId: string | null) => {
    if (selectedSlot) {
      setPhotoAdjustments(prev => ({
        ...prev,
        [selectedSlot]: {
          ...prev[selectedSlot],
          frameId
        }
      }));
    }
  };

  const handleApplyCrop = (crop: { x: number; y: number; width: number; height: number; scale: number }) => {
    if (selectedSlot) {
      setPhotoAdjustments(prev => ({
        ...prev,
        [selectedSlot]: {
          ...prev[selectedSlot],
          scale: crop.scale,
          offsetX: crop.x,
          offsetY: crop.y
        }
      }));
    }
  };

  const handleApplyOpacity = (opacity: number) => {
    if (selectedSlot) {
      setPhotoAdjustments(prev => ({
        ...prev,
        [selectedSlot]: {
          ...prev[selectedSlot],
          opacity
        }
      }));
    }
  };

  const handleApplyStyle = (filter: string) => {
    if (selectedSlot) {
      setPhotoAdjustments(prev => ({
        ...prev,
        [selectedSlot]: {
          ...prev[selectedSlot],
          filter
        }
      }));
    }
  };

  const selectedPhoto = selectedSlot ? getPhotoForSlot(selectedSlot) : null;

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
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={undo}
              disabled={!canUndo}
              title="Отменить (Ctrl+Z)"
              className="h-8 relative"
            >
              <Icon name="Undo" size={18} />
              {canUndo && currentIndex > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {currentIndex}
                </span>
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={redo}
              disabled={!canRedo}
              title="Повторить (Ctrl+Shift+Z)"
              className="h-8 relative"
            >
              <Icon name="Redo" size={18} />
              {canRedo && (historySize - currentIndex - 1) > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {historySize - currentIndex - 1}
                </span>
              )}
            </Button>
            <div className="h-6 w-px bg-gray-300 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistoryPanel(true)}
              title="История изменений"
              className="h-8"
            >
              <Icon name="History" size={18} />
              {historySize > 1 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {historySize}
                </span>
              )}
            </Button>
          </div>
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
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Добавить текст</label>
                  <Input
                    placeholder="Введите текст..."
                    value={textToAdd}
                    onChange={(e) => setTextToAdd(e.target.value)}
                    className="mb-2"
                  />
                  <Button variant="outline" className="w-full">
                    <Icon name="Plus" size={18} className="mr-2" />
                    Добавить на страницу
                  </Button>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Стили текста</p>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <span className="font-bold">Жирный</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <span className="italic">Курсив</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <span className="underline">Подчеркнутый</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {leftPanelTab === 'templates' && (
              <div className="space-y-2">
                <p className="text-sm font-medium mb-2">Шаблоны раскладки</p>
                <div className="grid grid-cols-2 gap-2">
                  {['2 фото', '3 фото', '4 фото', '5 фото', '6 фото'].map((template) => (
                    <Button
                      key={template}
                      variant="outline"
                      className="h-20 flex flex-col gap-1"
                      size="sm"
                    >
                      <Icon name="LayoutGrid" size={24} />
                      <span className="text-xs">{template}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {leftPanelTab === 'bg' && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Цвет фона</p>
                <div className="grid grid-cols-5 gap-2">
                  {['#FFFFFF', '#F3F4F6', '#E5E7EB', '#FEF3C7', '#FEE2E2', '#DBEAFE', '#D1FAE5'].map((color) => (
                    <button
                      key={color}
                      className="w-full aspect-square rounded border-2 hover:border-yellow-400"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {leftPanelTab === 'frames' && (
              <div className="space-y-2">
                <p className="text-sm font-medium mb-2">Рамки для фото</p>
                <div className="space-y-2">
                  {['Без рамки', 'Белая', 'Черная', 'Золотая'].map((frame) => (
                    <Button
                      key={frame}
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                    >
                      {frame}
                    </Button>
                  ))}
                </div>
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
                                onFrame={handleToolFrame}
                                onReplace={handleToolReplace}
                                onCrop={handleToolCrop}
                                onTransparency={handleToolTransparency}
                                onMakeBackground={handleToolMakeBackground}
                                onClear={handleToolClear}
                                onStyle={handleToolStyle}
                              />
                            </>
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

      {/* Tool Dialogs */}
      {selectedPhoto && (
        <>
          <FrameSelector
            open={showFrameSelector}
            onClose={() => setShowFrameSelector(false)}
            onSelectFrame={handleApplyFrame}
          />
          
          <CropTool
            open={showCropTool}
            onClose={() => setShowCropTool(false)}
            photoUrl={selectedPhoto.url}
            onApply={handleApplyCrop}
          />
          
          <TransparencyTool
            open={showTransparencyTool}
            onClose={() => setShowTransparencyTool(false)}
            photoUrl={selectedPhoto.url}
            currentOpacity={photoAdjustments[selectedSlot!]?.opacity}
            onApply={handleApplyOpacity}
          />
          
          <StyleSelector
            open={showStyleSelector}
            onClose={() => setShowStyleSelector(false)}
            photoUrl={selectedPhoto.url}
            onApplyStyle={handleApplyStyle}
          />
        </>
      )}

      {/* History Panel */}
      <HistoryPanel
        open={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        historySize={historySize}
        currentIndex={currentIndex}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />
    </div>
  );
};

export default PhotobookEditorAdvanced;