import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StyleSelectorProps {
  open: boolean;
  onClose: () => void;
  photoUrl: string;
  onApplyStyle: (style: string) => void;
}

const FILTERS = [
  { id: 'none', name: 'Оригинал', filter: 'none' },
  { id: 'grayscale', name: 'Ч/Б', filter: 'grayscale(100%)' },
  { id: 'sepia', name: 'Сепия', filter: 'sepia(100%)' },
  { id: 'vintage', name: 'Винтаж', filter: 'sepia(50%) contrast(120%)' },
  { id: 'bright', name: 'Яркий', filter: 'brightness(120%) saturate(130%)' },
  { id: 'contrast', name: 'Контраст', filter: 'contrast(150%)' },
  { id: 'warm', name: 'Теплый', filter: 'sepia(30%) saturate(120%)' },
  { id: 'cold', name: 'Холодный', filter: 'hue-rotate(180deg) saturate(120%)' },
];

const EFFECTS = [
  { id: 'blur', name: 'Размытие', filter: 'blur(3px)' },
  { id: 'sharpen', name: 'Резкость', filter: 'contrast(120%) brightness(110%)' },
  { id: 'fade', name: 'Выцветание', filter: 'opacity(70%) saturate(80%)' },
  { id: 'drama', name: 'Драма', filter: 'contrast(160%) brightness(90%)' },
];

const StyleSelector = ({ open, onClose, photoUrl, onApplyStyle }: StyleSelectorProps) => {
  const handleSelect = (style: string) => {
    onApplyStyle(style);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Выберите стиль</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="filters" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="filters">Фильтры</TabsTrigger>
            <TabsTrigger value="effects">Эффекты</TabsTrigger>
          </TabsList>

          <TabsContent value="filters" className="space-y-4">
            <div className="grid grid-cols-4 gap-4 py-4">
              {FILTERS.map((filter) => (
                <Card
                  key={filter.id}
                  className="p-2 cursor-pointer hover:shadow-lg transition-all hover:border-yellow-400"
                  onClick={() => handleSelect(filter.filter)}
                >
                  <div className="aspect-square mb-2 rounded overflow-hidden">
                    <img
                      src={photoUrl}
                      alt={filter.name}
                      className="w-full h-full object-cover"
                      style={{ filter: filter.filter }}
                    />
                  </div>
                  <p className="text-sm text-center font-medium">{filter.name}</p>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="effects" className="space-y-4">
            <div className="grid grid-cols-4 gap-4 py-4">
              {EFFECTS.map((effect) => (
                <Card
                  key={effect.id}
                  className="p-2 cursor-pointer hover:shadow-lg transition-all hover:border-yellow-400"
                  onClick={() => handleSelect(effect.filter)}
                >
                  <div className="aspect-square mb-2 rounded overflow-hidden">
                    <img
                      src={photoUrl}
                      alt={effect.name}
                      className="w-full h-full object-cover"
                      style={{ filter: effect.filter }}
                    />
                  </div>
                  <p className="text-sm text-center font-medium">{effect.name}</p>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default StyleSelector;
