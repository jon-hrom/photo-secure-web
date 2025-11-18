import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { PhotobookConfig, PhotobookFormat, PhotobookLayer } from '../PhotobookCreator';

interface PhotobookConfigStepProps {
  config: PhotobookConfig;
  onComplete: (config: PhotobookConfig) => void;
  onClose: () => void;
}

const FORMAT_OPTIONS: Array<{ value: PhotobookFormat; label: string }> = [
  { value: '21x30', label: '21×30' },
  { value: '20x20', label: '20×20' },
  { value: '25x25', label: '25×25' },
  { value: '30x20', label: '30×20' },
  { value: '30x30', label: '30×30' },
];

const LAYER_OPTIONS: Array<{ value: PhotobookLayer; label: string }> = [
  { value: 'none', label: 'Без прослойки' },
  { value: '1mm', label: 'Картон 1 мм' },
  { value: '2mm', label: 'Картон 2 мм' },
];

const calculatePrice = (
  format: PhotobookFormat,
  layer: PhotobookLayer,
  spreads: number,
  copies: number
): number => {
  let basePrice = 500;
  
  if (format === '21x30') basePrice = 600;
  else if (format === '25x25') basePrice = 650;
  else if (format === '30x20') basePrice = 700;
  else if (format === '30x30') basePrice = 800;
  
  if (layer === '1mm') basePrice += 100;
  else if (layer === '2mm') basePrice += 150;
  
  basePrice += spreads * 50;
  
  return basePrice * copies;
};

const PhotobookConfigStep = ({ config, onComplete, onClose }: PhotobookConfigStepProps) => {
  const [format, setFormat] = useState<PhotobookFormat>(config.format);
  const [layer, setLayer] = useState<PhotobookLayer>(config.layer);
  const [spreadsCount, setSpreadsCount] = useState<number>(config.spreadsCount);
  const [copiesCount, setCopiesCount] = useState<number>(config.copiesCount);

  const price = calculatePrice(format, layer, spreadsCount, copiesCount);

  const handleNext = () => {
    onComplete({
      format,
      layer,
      spreadsCount,
      copiesCount,
      price
    });
  };

  const incrementSpreads = () => setSpreadsCount(prev => Math.min(prev + 1, 25));
  const decrementSpreads = () => setSpreadsCount(prev => Math.max(prev - 1, 1));
  const incrementCopies = () => setCopiesCount(prev => prev + 1);
  const decrementCopies = () => setCopiesCount(prev => Math.max(prev - 1, 1));

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="flex items-center justify-between mb-3 md:mb-6">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Фотокниги на фотобумаге</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <Icon name="X" size={20} />
        </Button>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card className="p-3 sm:p-4 md:p-6 border-2">
          <div className="space-y-4 md:space-y-6">
            <div>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 md:mb-3">Формат</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2">
                {FORMAT_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={format === option.value ? 'default' : 'outline'}
                    className={`h-10 sm:h-11 md:h-12 text-xs sm:text-sm ${format === option.value ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                    onClick={() => setFormat(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 md:mb-3">Прослойка</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2">
                {LAYER_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={layer === option.value ? 'default' : 'outline'}
                    className={`h-10 sm:h-11 md:h-12 text-xs sm:text-sm ${layer === option.value ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                    onClick={() => setLayer(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 md:mb-3">Количество разворотов</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-600 hover:bg-purple-700 text-white border-none h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10"
                    onClick={decrementSpreads}
                    disabled={spreadsCount <= 1}
                  >
                    <Icon name="Minus" size={14} />
                  </Button>
                  <div className="flex-1 text-center text-lg sm:text-xl md:text-2xl font-semibold bg-gray-100 py-1 sm:py-2 rounded">
                    {spreadsCount}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-600 hover:bg-purple-700 text-white border-none h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10"
                    onClick={incrementSpreads}
                    disabled={spreadsCount >= 25}
                  >
                    <Icon name="Plus" size={14} />
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 md:mb-3">Количество экземпляров</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-600 hover:bg-purple-700 text-white border-none h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10"
                    onClick={decrementCopies}
                    disabled={copiesCount <= 1}
                  >
                    <Icon name="Minus" size={14} />
                  </Button>
                  <div className="flex-1 text-center text-lg sm:text-xl md:text-2xl font-semibold bg-gray-100 py-1 sm:py-2 rounded">
                    {copiesCount}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-600 hover:bg-purple-700 text-white border-none h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10"
                    onClick={incrementCopies}
                  >
                    <Icon name="Plus" size={14} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 md:pt-4 border-t-2">
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm sm:text-base md:text-lg px-6 sm:px-8 md:px-12 w-full sm:w-auto"
                onClick={handleNext}
              >
                Далее
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PhotobookConfigStep;