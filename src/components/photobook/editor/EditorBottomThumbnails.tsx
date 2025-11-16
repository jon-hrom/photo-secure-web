import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { PhotoSlot } from '../PhotobookCreator';

interface Spread {
  id: string;
  type: 'cover' | 'spread';
  slots: PhotoSlot[];
}

interface EditorBottomThumbnailsProps {
  spreads: Spread[];
  currentSpreadIndex: number;
  onSpreadSelect: (index: number) => void;
}

const EditorBottomThumbnails = ({
  spreads,
  currentSpreadIndex,
  onSpreadSelect,
}: EditorBottomThumbnailsProps) => {
  return (
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
            onClick={() => onSpreadSelect(index)}
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
  );
};

export default EditorBottomThumbnails;
