import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LayoutOption {
  id: string;
  photoCount: number;
  layout: Array<{ cols: number; rows: number }>;
  preview: string;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: '2-photos',
    photoCount: 2,
    layout: [{ cols: 2, rows: 1 }],
    preview: 'grid-cols-2'
  },
  {
    id: '3-photos-1',
    photoCount: 3,
    layout: [{ cols: 3, rows: 1 }],
    preview: 'grid-cols-3'
  },
  {
    id: '4-photos-1',
    photoCount: 4,
    layout: [{ cols: 2, rows: 2 }],
    preview: 'grid-cols-2 grid-rows-2'
  },
  {
    id: '4-photos-2',
    photoCount: 4,
    layout: [{ cols: 4, rows: 1 }],
    preview: 'grid-cols-4'
  },
  {
    id: '5-photos',
    photoCount: 5,
    layout: [{ cols: 3, rows: 2 }],
    preview: 'grid-cols-3'
  },
  {
    id: '6-photos',
    photoCount: 6,
    layout: [{ cols: 3, rows: 2 }],
    preview: 'grid-cols-3 grid-rows-2'
  },
  {
    id: '7-photos',
    photoCount: 7,
    layout: [{ cols: 4, rows: 2 }],
    preview: 'grid-cols-4'
  },
];

interface PhotobookLayoutSelectorProps {
  selectedPhotos: Array<{ id: string; url: string }>;
  onConfirm: (layoutId: string) => void;
  onBack: () => void;
}

const PhotobookLayoutSelector = ({ selectedPhotos, onConfirm, onBack }: PhotobookLayoutSelectorProps) => {
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'name' | 'date'>('name');

  const handleConfirm = () => {
    if (selectedLayout) {
      onConfirm(selectedLayout);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-2xl font-bold">Выберите коллажи</h2>
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="X" size={24} />
        </Button>
      </div>

      <div className="space-y-6">
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              Задайте порядок расположения фотографий в дизайне.
            </p>
            <Select value={sortOrder} onValueChange={(value: 'name' | 'date') => setSortOrder(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">По названию</SelectItem>
                <SelectItem value="date">По дате</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {selectedPhotos.map((photo, index) => (
              <div key={photo.id} className="relative flex-shrink-0">
                <img
                  src={photo.url}
                  alt={`Photo ${index + 1}`}
                  className="w-24 h-24 object-cover rounded border-2 border-gray-300"
                />
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-4 text-lg">
            Выберите типы коллажей (по количеству фото) для создания дизайна.
          </h3>

          <div className="grid grid-cols-4 gap-4">
            {LAYOUT_OPTIONS.map((option) => (
              <Card
                key={option.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                  selectedLayout === option.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => setSelectedLayout(option.id)}
              >
                <div className="aspect-[4/3] bg-gray-200 rounded mb-3 p-2 relative">
                  {selectedLayout === option.id && (
                    <div className="absolute top-1 right-1 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center">
                      <Icon name="Check" size={14} />
                    </div>
                  )}
                  <div className={`grid ${option.preview} gap-1 h-full`}>
                    {Array.from({ length: option.photoCount }).map((_, i) => (
                      <div key={i} className="bg-gray-300 rounded" />
                    ))}
                  </div>
                </div>
                <p className="text-center text-sm font-semibold">
                  {option.photoCount} Фото
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          size="lg"
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-8"
          onClick={handleConfirm}
          disabled={!selectedLayout}
        >
          Применить
        </Button>
      </div>
    </div>
  );
};

export default PhotobookLayoutSelector;
