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
        <h2 className="text-xl font-bold">Редактор коллажей</h2>
        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          onClick={handleComplete}
        >
          Завершить
        </Button>
      </div>

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
              viewBox={`0 0 ${dimensions.width * 2} ${dimensions.height}`}
              className="max-w-full max-h-full border-2 border-gray-300 bg-white"
              style={{ aspectRatio: `${dimensions.width * 2} / ${dimensions.height}` }}
            >
              {/* Левая страница */}
              <rect x={0} y={0} width={dimensions.width} height={dimensions.height} fill="#ffffff" />
              
              {/* Правая страница */}
              <rect x={dimensions.width} y={0} width={dimensions.width} height={dimensions.height} fill="#ffffff" />
              
              {/* Корешок */}
              <rect
                x={spinePosition - spineWidth / 2}
                y={0}
                width={spineWidth}
                height={dimensions.height}
                fill="#e5e7eb"
              />

              {/* Слоты коллажа */}
              {selectedSpread.slots.map((slot, idx) => (
                <g key={idx}>
                  <rect
                    x={slot.x}
                    y={slot.y}
                    width={slot.width}
                    height={slot.height}
                    fill="#f3f4f6"
                    stroke="#d1d5db"
                    strokeWidth="2"
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
                </g>
              ))}
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
      </div>
    </div>
  );
};

export default CollageBasedEditor;