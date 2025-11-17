import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { PhotobookFillMethod } from '../PhotobookCreator';

interface PhotobookFillMethodStepProps {
  onSelect: (method: PhotobookFillMethod) => void;
  onBack: () => void;
}

const PhotobookFillMethodStep = ({ onSelect, onBack }: PhotobookFillMethodStepProps) => {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-2xl font-bold">Выберите способ заполнения фотокниги</h2>
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="X" size={24} />
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-12">
        <Card 
          className="p-8 cursor-pointer hover:shadow-xl transition-shadow border-2 hover:border-purple-600"
          onClick={() => onSelect('auto')}
        >
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="grid grid-cols-2 gap-2 w-full max-w-[200px]">
              <div className="aspect-[3/4] bg-gray-200 rounded overflow-hidden">
                <img 
                  src="https://cdn.poehali.dev/files/c9862e95-f088-4324-b5f5-87a7d8d09680.jpg"
                  alt="Auto layout preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-[3/4] bg-gray-200 rounded overflow-hidden">
                <img 
                  src="https://cdn.poehali.dev/files/c9862e95-f088-4324-b5f5-87a7d8d09680.jpg"
                  alt="Auto layout preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-[3/4] bg-gray-200 rounded overflow-hidden">
                <img 
                  src="https://cdn.poehali.dev/files/c9862e95-f088-4324-b5f5-87a7d8d09680.jpg"
                  alt="Auto layout preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-[3/4] bg-gray-200 rounded overflow-hidden">
                <img 
                  src="https://cdn.poehali.dev/files/c9862e95-f088-4324-b5f5-87a7d8d09680.jpg"
                  alt="Auto layout preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <h3 className="text-2xl font-bold">Автоматически</h3>
            <p className="text-muted-foreground text-lg">
              Автоматическая сборка фотокниги из выбранных фотографий.
            </p>
            <Button 
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full"
            >
              Автоматически
            </Button>
          </div>
        </Card>

        <Card 
          className="p-8 cursor-pointer hover:shadow-xl transition-shadow border-2 hover:border-purple-600"
          onClick={() => onSelect('manual')}
        >
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-full max-w-[200px] aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                <Icon name="User" size={32} className="text-gray-400" />
              </div>
              <Icon name="Plus" size={40} className="text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold">Вручную</h3>
            <p className="text-muted-foreground text-lg">
              Вы самостоятельно выбираете и расставляете фотографии по страницам.
            </p>
            <Button 
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full"
            >
              Вручную
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PhotobookFillMethodStep;