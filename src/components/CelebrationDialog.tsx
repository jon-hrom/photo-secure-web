import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

export type CelebrationKind = 'energy' | 'tariff';

interface Props {
  open: boolean;
  onClose: () => void;
  kind: CelebrationKind;
  energyBalance?: number;
  planName?: string;
}

export const CelebrationDialog = ({ open, onClose, kind, energyBalance, planName }: Props) => {
  const isEnergy = kind === 'energy';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm overflow-hidden p-0 border-0">
        <div className="bg-gradient-to-br from-primary via-purple-500 to-fuchsia-500 px-6 pt-10 pb-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm animate-scale-in">
            <Icon name={isEnergy ? 'Zap' : 'PartyPopper'} size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {isEnergy ? 'Баланс пополнен!' : 'Тариф активирован!'}
          </h2>
          <p className="text-white/90 text-sm">
            {isEnergy ? 'Энергия успешно зачислена' : 'Новый тариф уже работает'}
          </p>
        </div>

        <div className="px-6 py-6 text-center space-y-4">
          {isEnergy && typeof energyBalance === 'number' && (
            <div className="rounded-2xl bg-muted/60 py-4">
              <p className="text-sm text-muted-foreground">Текущий баланс</p>
              <p className="flex items-center justify-center gap-2 text-3xl font-bold">
                <Icon name="Zap" size={26} className="text-yellow-500" />
                {energyBalance}
              </p>
            </div>
          )}
          {!isEnergy && planName && (
            <div className="rounded-2xl bg-muted/60 py-4">
              <p className="text-sm text-muted-foreground">Ваш тариф</p>
              <p className="text-2xl font-bold">{planName}</p>
            </div>
          )}

          <p className="text-base font-medium">
            Приятного использования и красивых кадров! 📸✨
          </p>
          <p className="text-sm text-muted-foreground">
            Спасибо, что выбираете нас. Мы рядом, чтобы ваша работа сияла.
          </p>

          <Button className="w-full h-11" size="lg" onClick={onClose}>
            <Icon name="Heart" size={18} className="mr-2" />
            Отлично!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CelebrationDialog;
