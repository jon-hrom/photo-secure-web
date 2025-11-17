import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { PhotobookConfig, UploadedPhoto } from './PhotobookCreator';
import { getFormatDimensions } from './layoutUtils';
import { detectFacesInPhotos, type PhotoWithFaces } from '@/utils/faceDetection';
import {
  generateSmartLayout,
  type PlacedPhoto,
  type SpreadConfig,
} from '@/utils/smartLayoutEngine';

interface SmartPhotobookEditorProps {
  config: PhotobookConfig;
  photos: UploadedPhoto[];
  onComplete: (spreads: Array<{ id: string; photos: PlacedPhoto[] }>) => void;
  onBack: () => void;
}

const SmartPhotobookEditor = ({
  config,
  photos,
  onComplete,
  onBack,
}: SmartPhotobookEditorProps) => {
  const [spreads, setSpreads] = useState<Array<{ id: string; photos: PlacedPhoto[] }>>([]);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  
  const canvasRef = useRef<SVGSVGElement>(null);

  const dimensions = getFormatDimensions(config.format);
  const spinePosition = dimensions.width;
  const spineWidth = 10;
  const safeMargin = 15;

  useEffect(() => {
    generateAllSpreads();
  }, [config, photos]);

  const generateAllSpreads = async () => {
    setIsGenerating(true);

    try {
      const photosWithMeta = photos.map((p) => ({
        id: p.id,
        url: p.url,
        width: p.width || 800,
        height: p.height || 600,
      }));

      const photosWithFaces: PhotoWithFaces[] = await detectFacesInPhotos(photosWithMeta);

      const photosPerSpread = Math.ceil(photos.length / config.spreadsCount);
      const generatedSpreads: Array<{ id: string; photos: PlacedPhoto[] }> = [];

      for (let i = 0; i < config.spreadsCount; i++) {
        const startIdx = i * photosPerSpread;
        const endIdx = Math.min(startIdx + photosPerSpread, photos.length);
        const spreadPhotos = photosWithFaces.slice(startIdx, endIdx);

        const spreadConfig: SpreadConfig = {
          width: dimensions.width * 2,
          height: dimensions.height,
          safeMargin,
          spinePosition,
          spineWidth,
        };

        const placedPhotos = generateSmartLayout(spreadPhotos, spreadConfig);

        generatedSpreads.push({
          id: `spread-${i}`,
          photos: placedPhotos,
        });
      }

      setSpreads(generatedSpreads);
    } catch (error) {
      console.error('Failed to generate layouts:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<SVGRectElement>, photoId: string) => {
    e.stopPropagation();
    setSelectedPhotoId(photoId);
    setIsDragging(true);

    const svg = canvasRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const scale = dimensions.width * 2 / rect.width;

    setDragStart({
      x: (e.clientX - rect.left) * scale,
      y: (e.clientY - rect.top) * scale,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !selectedPhotoId || !dragStart) return;

    const svg = canvasRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const scale = dimensions.width * 2 / rect.width;

    const currentX = (e.clientX - rect.left) * scale;
    const currentY = (e.clientY - rect.top) * scale;

    const deltaX = currentX - dragStart.x;
    const deltaY = currentY - dragStart.y;

    setSpreads((prevSpreads) =>
      prevSpreads.map((spread, idx) => {
        if (idx !== currentSpreadIndex) return spread;

        return {
          ...spread,
          photos: spread.photos.map((photo) => {
            if (photo.id !== selectedPhotoId) return photo;

            let newX = photo.x + deltaX;
            let newY = photo.y + deltaY;

            newX = Math.max(safeMargin, Math.min(newX, dimensions.width * 2 - safeMargin - photo.width));
            newY = Math.max(safeMargin, Math.min(newY, dimensions.height - safeMargin - photo.height));

            return { ...photo, x: newX, y: newY };
          }),
        };
      })
    );

    setDragStart({ x: currentX, y: currentY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handlePhotoScale = (photoId: string, scaleDelta: number) => {
    setSpreads((prevSpreads) =>
      prevSpreads.map((spread, idx) => {
        if (idx !== currentSpreadIndex) return spread;

        return {
          ...spread,
          photos: spread.photos.map((photo) => {
            if (photo.id !== photoId) return photo;

            const newScale = Math.max(0.5, Math.min(2, photo.scale + scaleDelta));
            const newWidth = photo.width * (newScale / photo.scale);
            const newHeight = photo.height * (newScale / photo.scale);

            return {
              ...photo,
              scale: newScale,
              width: newWidth,
              height: newHeight,
            };
          }),
        };
      })
    );
  };

  const handleRegenerateLayout = () => {
    generateAllSpreads();
  };

  const handleComplete = () => {
    onComplete(spreads);
  };

  const currentSpread = spreads[currentSpreadIndex];

  return (
    <div className="h-[85vh] flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-xl font-bold">Умный редактор макета</h2>
        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          onClick={handleComplete}
        >
          Далее
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={showGrid ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowGrid(!showGrid)}
          className={showGrid ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
        >
          <Icon name="Grid3x3" size={16} className="mr-1" />
          Сетка
        </Button>
        <Button variant="outline" size="sm" onClick={handleRegenerateLayout} disabled={isGenerating}>
          <Icon name="RefreshCw" size={16} className="mr-1" />
          {isGenerating ? 'Генерация...' : 'Перегенерировать'}
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg p-4 overflow-auto">
        {isGenerating ? (
          <div className="text-center">
            <Icon name="Loader2" size={48} className="animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Анализирую фото и создаю макет...</p>
          </div>
        ) : currentSpread ? (
          <svg
            ref={canvasRef}
            width={dimensions.width * 2}
            height={dimensions.height}
            className="border-2 border-gray-400 bg-white shadow-lg"
            style={{ maxWidth: '100%', height: 'auto' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {showGrid && (
              <g opacity="0.2">
                {Array.from({ length: 20 }, (_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={(dimensions.width * 2 * i) / 20}
                    y1={0}
                    x2={(dimensions.width * 2 * i) / 20}
                    y2={dimensions.height}
                    stroke="#999"
                    strokeWidth="1"
                  />
                ))}
                {Array.from({ length: 10 }, (_, i) => (
                  <line
                    key={`h-${i}`}
                    x1={0}
                    y1={(dimensions.height * i) / 10}
                    x2={dimensions.width * 2}
                    y2={(dimensions.height * i) / 10}
                    stroke="#999"
                    strokeWidth="1"
                  />
                ))}
              </g>
            )}

            <rect
              x={safeMargin}
              y={safeMargin}
              width={dimensions.width * 2 - safeMargin * 2}
              height={dimensions.height - safeMargin * 2}
              fill="none"
              stroke="#FCD34D"
              strokeWidth="3"
              strokeDasharray="10,5"
            />

            <line
              x1={spinePosition}
              y1={0}
              x2={spinePosition}
              y2={dimensions.height}
              stroke="#3B82F6"
              strokeWidth={spineWidth}
              opacity="0.6"
            />

            <line
              x1={spinePosition - 15}
              y1={0}
              x2={spinePosition - 15}
              y2={dimensions.height}
              stroke="#3B82F6"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.4"
            />
            <line
              x1={spinePosition + 15}
              y1={0}
              x2={spinePosition + 15}
              y2={dimensions.height}
              stroke="#3B82F6"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.4"
            />

            {currentSpread.photos.map((photo) => (
              <g key={photo.id}>
                <image
                  href={photo.url}
                  x={photo.x}
                  y={photo.y}
                  width={photo.width}
                  height={photo.height}
                  preserveAspectRatio="xMidYMid slice"
                  className="cursor-move"
                />
                <rect
                  x={photo.x}
                  y={photo.y}
                  width={photo.width}
                  height={photo.height}
                  fill="transparent"
                  stroke={selectedPhotoId === photo.id ? '#A855F7' : 'transparent'}
                  strokeWidth="3"
                  className="cursor-move"
                  onMouseDown={(e) => handleMouseDown(e, photo.id)}
                />

                {photo.faces.map((face, faceIdx) => (
                  <rect
                    key={`face-${photo.id}-${faceIdx}`}
                    x={photo.x + face.x * photo.width}
                    y={photo.y + face.y * photo.height}
                    width={face.width * photo.width}
                    height={face.height * photo.height}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                    opacity="0.7"
                  />
                ))}
              </g>
            ))}
          </svg>
        ) : (
          <p className="text-gray-500">Нет данных для отображения</p>
        )}
      </div>

      {selectedPhotoId && (
        <div className="mt-4 flex items-center justify-center gap-3 bg-white p-3 rounded-lg shadow">
          <span className="text-sm font-medium">Масштаб:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePhotoScale(selectedPhotoId, -0.1)}
          >
            <Icon name="Minus" size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePhotoScale(selectedPhotoId, 0.1)}
          >
            <Icon name="Plus" size={16} />
          </Button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentSpreadIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentSpreadIndex === 0}
        >
          <Icon name="ChevronLeft" size={20} />
        </Button>
        <span className="text-sm font-medium">
          Разворот {currentSpreadIndex + 1} из {spreads.length}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentSpreadIndex((prev) => Math.min(spreads.length - 1, prev + 1))}
          disabled={currentSpreadIndex === spreads.length - 1}
        >
          <Icon name="ChevronRight" size={20} />
        </Button>
      </div>
    </div>
  );
};

export default SmartPhotobookEditor;
