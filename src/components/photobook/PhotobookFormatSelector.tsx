import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { PhotobookFormat } from './PhotobookCreator';

interface PhotobookFormatSelectorProps {
  onSelect: (format: PhotobookFormat) => void;
}

const formats = [
  { 
    id: '20x20' as PhotobookFormat, 
    name: '20×20 см', 
    description: 'Квадратный формат',
    icon: 'Square',
    popular: true
  },
  { 
    id: '21x30' as PhotobookFormat, 
    name: '21×30 см (А4)', 
    description: 'Стандартный альбомный формат',
    icon: 'FileText',
    popular: true
  },
  { 
    id: '30x30' as PhotobookFormat, 
    name: '30×30 см', 
    description: 'Большой квадратный формат',
    icon: 'Maximize',
    popular: false
  },
];

const PhotobookFormatSelector = ({ onSelect }: PhotobookFormatSelectorProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">Выберите формат фотокниги</h3>
        <p className="text-muted-foreground">Формат определяет размер готовой книги</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {formats.map((format) => (
          <Card
            key={format.id}
            className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary hover-scale relative overflow-hidden"
            onClick={() => onSelect(format.id)}
          >
            {format.popular && (
              <div className="absolute top-2 right-2">
                <div className="bg-primary text-white text-xs px-2 py-1 rounded-full">
                  Популярный
                </div>
              </div>
            )}
            <CardContent className="p-6 text-center space-y-4">
              <div className="bg-primary/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto">
                <Icon name={format.icon as any} size={40} className="text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-lg mb-1">{format.name}</h4>
                <p className="text-sm text-muted-foreground">{format.description}</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-primary">
                <span className="text-sm font-medium">Выбрать</span>
                <Icon name="ArrowRight" size={16} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PhotobookFormatSelector;
