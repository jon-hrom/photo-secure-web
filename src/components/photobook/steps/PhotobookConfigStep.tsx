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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Фотокниги на фотобумаге</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <Icon name="X" size={24} />
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="flex items-center justify-center">
          <img 
            src="https://cdn.poehali.dev/files/4d8b3969-1126-4235-a3f6-d72443f1d0fc.jpg" 
            alt="Photobook preview"
            className="w-full max-w-md rounded-lg shadow-lg"
          />
        </div>

        <Card className="p-6 border-2">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3 text-lg">Формат</h3>
              <div className="grid grid-cols-2 gap-2">
                {FORMAT_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={format === option.value ? 'default' : 'outline'}
                    className={`h-12 ${format === option.value ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : ''}`}
                    onClick={() => setFormat(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-lg">Прослойка</h3>
              <div className="grid grid-cols-2 gap-2">
                {LAYER_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={layer === option.value ? 'default' : 'outline'}
                    className={`h-12 ${layer === option.value ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : ''}`}
                    onClick={() => setLayer(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-3 text-lg">Количество разворотов</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-yellow-400 hover:bg-yellow-500 text-black border-none h-10 w-10"
                    onClick={decrementSpreads}
                    disabled={spreadsCount <= 1}
                  >
                    <Icon name="Minus" size={18} />
                  </Button>
                  <div className="flex-1 text-center text-2xl font-semibold bg-gray-100 py-2 rounded">
                    {spreadsCount}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-yellow-400 hover:bg-yellow-500 text-black border-none h-10 w-10"
                    onClick={incrementSpreads}
                    disabled={spreadsCount >= 25}
                  >
                    <Icon name="Plus" size={18} />
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-lg">Количество экземпляров</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-yellow-400 hover:bg-yellow-500 text-black border-none h-10 w-10"
                    onClick={decrementCopies}
                    disabled={copiesCount <= 1}
                  >
                    <Icon name="Minus" size={18} />
                  </Button>
                  <div className="flex-1 text-center text-2xl font-semibold bg-gray-100 py-2 rounded">
                    {copiesCount}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-yellow-400 hover:bg-yellow-500 text-black border-none h-10 w-10"
                    onClick={incrementCopies}
                  >
                    <Icon name="Plus" size={18} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t-2">
              <span className="text-2xl font-bold">Итого: {price.toLocaleString('ru-RU')} ₽</span>
              <Button
                size="lg"
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold text-lg px-8"
                onClick={handleNext}
              >
                Заказать
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PhotobookConfigStep;
