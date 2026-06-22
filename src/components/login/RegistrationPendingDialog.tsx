import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface RegistrationPendingDialogProps {
  open: boolean;
  email?: string;
  onClose: () => void;
}

const RegistrationPendingDialog = ({ open, email, onClose }: RegistrationPendingDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl text-center">
        <div className="flex flex-col items-center pt-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-4 shadow-lg">
            <Icon name="ClipboardCheck" size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">Заявка отправлена на проверку</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Спасибо за регистрацию! Мы изучаем ваше портфолио — обычно это занимает
            немного времени.
          </p>
          <div className="w-full bg-muted/50 rounded-xl p-4 text-left space-y-2 mb-4">
            <div className="flex items-start gap-2 text-sm">
              <Icon name="Mail" size={16} className="text-primary mt-0.5 shrink-0" />
              <span>
                Результат проверки придёт на вашу почту
                {email ? <> <b>{email}</b></> : ''}.
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Icon name="MessageCircle" size={16} className="text-primary mt-0.5 shrink-0" />
              <span>Уведомление также придёт в MAX по указанному телефону.</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            После одобрения вы сможете войти в аккаунт и начать работу.
          </p>
          <Button onClick={onClose} className="w-full rounded-xl h-11">
            Понятно
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationPendingDialog;
