import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

const HintsCard = () => {
  return (
    <Card className="shadow-xl" data-tour="hints-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <Icon name="HelpCircle" size={20} className="md:w-6 md:h-6" />
          Подсказки интерфейса
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">Управление всплывающими подсказками</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 md:p-4 bg-muted/30 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="Lightbulb" size={18} className="text-primary md:w-5 md:h-5" />
                <Label className="font-semibold text-sm md:text-base">Интерактивное обучение</Label>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Пошаговое знакомство со всеми возможностями сервиса
              </p>
            </div>
            <Button
              onClick={() => {
                localStorage.removeItem('onboardingTourCompleted');
                localStorage.removeItem('onboardingTourDisabled');
                toast.success('Обучение сброшено! Перезагрузите страницу для начала тура');
              }}
              variant="outline"
              size="sm"
              className="rounded-xl flex-shrink-0"
            >
              <Icon name="Play" size={16} className="mr-2" />
              <span className="hidden sm:inline">Пройти снова</span>
              <span className="sm:hidden">Начать</span>
            </Button>
          </div>
        </div>

        <div className="p-3 md:p-4 bg-muted/30 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="GripHorizontal" size={18} className="text-primary md:w-5 md:h-5" />
                <Label className="font-semibold text-sm md:text-base">Подсказки свайпов</Label>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Показывать стрелки при открытии карточки клиента
              </p>
            </div>
            <Button
              onClick={() => {
                localStorage.removeItem('clientDetailSwipeHintSeen');
                toast.success('Подсказки сброшены! Откройте карточку клиента чтобы увидеть их снова');
              }}
              variant="outline"
              size="sm"
              className="rounded-xl flex-shrink-0"
            >
              <Icon name="RotateCcw" size={16} className="mr-2" />
              <span className="hidden sm:inline">Показать снова</span>
              <span className="sm:hidden">Сброс</span>
            </Button>
          </div>
        </div>

        <div className="p-3 md:p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
          <div className="flex items-start gap-2 md:gap-3">
            <Icon name="Info" className="text-purple-600 mt-0.5 md:mt-1 flex-shrink-0" size={16} />
            <div className="text-xs md:text-sm">
              <p className="font-semibold text-purple-900 mb-1">Совет</p>
              <p className="text-purple-700">
                Подсказки появляются автоматически при первом использовании новых функций
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HintsCard;
