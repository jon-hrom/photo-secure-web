import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { PhotobookMethod } from '../PhotobookCreator';

interface PhotobookMethodStepProps {
  onSelect: (method: PhotobookMethod) => void;
  onBack: () => void;
}

const PhotobookMethodStep = ({ onSelect, onBack }: PhotobookMethodStepProps) => {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-2xl font-bold">Способ заказа</h2>
        <div className="w-10" />
      </div>

      <div className="max-w-md mx-auto mt-12">
        <Card 
          className="p-8 cursor-pointer hover:shadow-xl transition-shadow border-2 hover:border-purple-600"
          onClick={() => onSelect('package')}
        >
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
              <Icon name="Image" size={48} className="text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold">Мой дизайн</h3>
            <p className="text-muted-foreground text-lg">
              Создайте фотокнигу с нуля по вашему дизайну.
            </p>
            <Button 
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full"
            >
              Мой дизайн
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PhotobookMethodStep;