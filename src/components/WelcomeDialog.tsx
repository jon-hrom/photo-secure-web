import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface WelcomeDialogProps {
  open: boolean;
  userName?: string;
  onClose: () => void;
  onOpenSupport?: () => void;
}

const WelcomeDialog = ({ open, userName, onClose, onOpenSupport }: WelcomeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-4 shadow-lg">
            <Icon name="Sparkles" size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            Добро пожаловать{userName ? `, ${userName}` : ''}!
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Рады видеть вас в Foto-Mix! Желаем вам ярких съёмок, довольных клиентов
            и вдохновения каждый день.
          </p>

          <div className="w-full bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20 rounded-xl p-4 text-left mb-4">
            <div className="flex items-start gap-2">
              <Icon name="Wrench" size={18} className="text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/80 leading-relaxed">
                Сайт активно развивается и улучшается. Будем рады, если вы напишете
                в техподдержку и предложите свои идеи для удобства — по мере
                возможности мы воплотим самые интересные из них!
              </p>
            </div>
          </div>

          <div className="flex flex-col w-full gap-2">
            {onOpenSupport && (
              <Button
                variant="outline"
                onClick={() => { onClose(); onOpenSupport(); }}
                className="w-full rounded-xl h-11"
              >
                <Icon name="MessageCircle" size={18} className="mr-2" />
                Предложить идею
              </Button>
            )}
            <Button onClick={onClose} className="w-full rounded-xl h-11">
              Начать работу
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeDialog;
