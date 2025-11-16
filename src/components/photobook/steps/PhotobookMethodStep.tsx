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

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-12">
        <Card 
          className="p-8 cursor-pointer hover:shadow-xl transition-shadow border-2 hover:border-yellow-400"
          onClick={() => onSelect('template')}
        >
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
              <Icon name="Monitor" size={48} className="text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold">Выбрать шаблон</h3>
            <p className="text-muted-foreground text-lg">
              Сотни готовых тематических шаблонов помогут создать уникальный дизайн.
            </p>
            <Button 
              size="lg"
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold w-full"
            >
              Выбрать шаблон
            </Button>
          </div>
        </Card>

        <Card 
          className="p-8 cursor-pointer hover:shadow-xl transition-shadow border-2 hover:border-yellow-400"
          onClick={() => onSelect('package')}
        >
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="relative">
                <Icon name="FolderUp" size={48} className="text-gray-600" />
                <Icon name="ArrowUp" size={24} className="text-gray-600 absolute -top-2 -right-2" />
              </div>
            </div>
            <h3 className="text-2xl font-bold">Загрузите пакетом</h3>
            <p className="text-muted-foreground text-lg">
              Воспользуйтесь пакетной загрузкой для отправки всех макетов сразу.
            </p>
            <Button 
              size="lg"
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold w-full"
            >
              Загрузить пакетом
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PhotobookMethodStep;
