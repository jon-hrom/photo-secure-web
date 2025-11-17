import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { EditorType } from '../PhotobookCreator';

interface EditorTypeStepProps {
  onSelect: (type: EditorType) => void;
  onBack: () => void;
}

const EditorTypeStep = ({ onSelect, onBack }: EditorTypeStepProps) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-2xl font-bold">Выберите способ создания макета</h2>
        <div className="w-10"></div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Card 
          className="cursor-pointer hover:border-purple-600 transition-all hover:shadow-lg"
          onClick={() => onSelect('smart')}
        >
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-purple-100 p-4 rounded-full">
                <Icon name="Wand2" size={48} className="text-purple-600" />
              </div>
              <h3 className="text-xl font-bold">Умная вёрстка</h3>
              <p className="text-muted-foreground">
                Автоматическое размещение фотографий с защитой лиц и умным кадрированием
              </p>
              <ul className="text-sm text-left space-y-2 w-full">
                <li className="flex items-start gap-2">
                  <Icon name="Check" size={16} className="text-green-600 mt-0.5" />
                  <span>Распознавание и защита лиц</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon name="Check" size={16} className="text-green-600 mt-0.5" />
                  <span>Автоматическая компоновка</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon name="Check" size={16} className="text-green-600 mt-0.5" />
                  <span>Ручная корректировка</span>
                </li>
              </ul>
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                Выбрать
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-blue-600 transition-all hover:shadow-lg"
          onClick={() => onSelect('collage')}
        >
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-blue-100 p-4 rounded-full">
                <Icon name="LayoutTemplate" size={48} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold">Коллажи</h3>
              <p className="text-muted-foreground">
                Выбор готовых шаблонов коллажей для каждого разворота
              </p>
              <ul className="text-sm text-left space-y-2 w-full">
                <li className="flex items-start gap-2">
                  <Icon name="Check" size={16} className="text-green-600 mt-0.5" />
                  <span>Готовые шаблоны коллажей</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon name="Check" size={16} className="text-green-600 mt-0.5" />
                  <span>Выбор для каждого разворота</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon name="Check" size={16} className="text-green-600 mt-0.5" />
                  <span>Простота и удобство</span>
                </li>
              </ul>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Выбрать
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditorTypeStep;
