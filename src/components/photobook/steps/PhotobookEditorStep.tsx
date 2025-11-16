import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { PhotobookConfig, UploadedPhoto, PhotoSlot, PhotobookFillMethod } from '../PhotobookCreator';
import { generateLayout, generateRandomLayout } from '../layoutUtils';
import { getFormatDimensions } from '../layoutUtils';

interface PhotobookEditorStepProps {
  config: PhotobookConfig;
  photos: UploadedPhoto[];
  fillMethod: PhotobookFillMethod;
  onComplete: (spreads: Array<{ id: string; slots: PhotoSlot[] }>) => void;
  onBack: () => void;
}

const PhotobookEditorStep = ({ config, photos, fillMethod, onComplete, onBack }: PhotobookEditorStepProps) => {
  const [spreads, setSpreads] = useState<Array<{ id: string; slots: PhotoSlot[] }>>([]);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);

  useEffect(() => {
    const dimensions = getFormatDimensions(config.format);
    const photosPerSpread = Math.ceil(photos.length / config.spreadsCount);
    
    const generatedSpreads = Array.from({ length: config.spreadsCount }, (_, i) => {
      const slots = fillMethod === 'auto' 
        ? generateRandomLayout(photosPerSpread, dimensions.width, dimensions.height, 5)
        : generateLayout(photosPerSpread, dimensions.width, dimensions.height, 5);
      
      const photosForSpread = photos.slice(i * photosPerSpread, (i + 1) * photosPerSpread);
      const slotsWithPhotos = slots.map((slot, idx) => ({
        ...slot,
        photoId: photosForSpread[idx]?.id
      }));

      return {
        id: `spread-${i}`,
        slots: slotsWithPhotos
      };
    });

    setSpreads(generatedSpreads);
  }, [config, photos, fillMethod]);

  const handleComplete = () => {
    onComplete(spreads);
  };

  const currentSpread = spreads[currentSpreadIndex];
  const dimensions = getFormatDimensions(config.format);

  return (
    <div className="h-[85vh] flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-xl font-bold">Редактор макета</h2>
        <Button 
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          onClick={handleComplete}
        >
          Далее
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg p-8">
        {currentSpread && (
          <svg
            width={dimensions.width * 2}
            height={dimensions.height * 2}
            className="border-2 border-gray-300 bg-white"
          >
            <line
              x1={dimensions.width}
              y1={0}
              x2={dimensions.width}
              y2={dimensions.height * 2}
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="8,4"
              opacity="0.4"
            />
            
            {currentSpread.slots.map((slot) => {
              const photo = photos.find(p => p.id === slot.photoId);
              return (
                <g key={slot.id}>
                  {photo ? (
                    <image
                      href={photo.url}
                      x={slot.x * 2}
                      y={slot.y * 2}
                      width={slot.width * 2}
                      height={slot.height * 2}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  ) : (
                    <>
                      <rect
                        x={slot.x * 2}
                        y={slot.y * 2}
                        width={slot.width * 2}
                        height={slot.height * 2}
                        fill="#e5e7eb"
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                      <text
                        x={(slot.x + slot.width / 2) * 2}
                        y={(slot.y + slot.height / 2) * 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="24"
                        fill="#6b7280"
                      >
                        {slot.orientation === 'horizontal' ? '📷' : '📸'}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentSpreadIndex(prev => Math.max(0, prev - 1))}
          disabled={currentSpreadIndex === 0}
        >
          <Icon name="ChevronLeft" size={20} />
        </Button>
        <span className="text-sm">
          Разворот {currentSpreadIndex + 1} из {spreads.length}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentSpreadIndex(prev => Math.min(spreads.length - 1, prev + 1))}
          disabled={currentSpreadIndex === spreads.length - 1}
        >
          <Icon name="ChevronRight" size={20} />
        </Button>
      </div>
    </div>
  );
};

export default PhotobookEditorStep;
