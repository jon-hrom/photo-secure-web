import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface BlockedUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockReason?: string;
  userEmail?: string;
  userId?: number;
  authMethod?: string;
}

const BlockedUserDialog = ({
  open,
  onOpenChange,
  blockReason,
  userEmail,
  userId,
  authMethod = 'email'
}: BlockedUserDialogProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
      audio.volume = 0.3;
      audio.play().catch(() => {});
      
      setTimeout(() => setIsVisible(true), 50);
    } else {
      setIsVisible(false);
    }
  }, [open]);

  const handleSendAppeal = async () => {
    if (!message.trim()) {
      toast.error('Напишите сообщение');
      return;
    }

    setSending(true);

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_appeal',
          user_identifier: String(userId),
          user_email: userEmail,
          auth_method: authMethod,
          message: message.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Обращение отправлено! Администратор свяжется с вами на email.');
        setMessage('');
        onOpenChange(false);
      } else {
        toast.error(data.error || 'Ошибка отправки обращения');
      }
    } catch (error) {
      console.error('Error sending appeal:', error);
      toast.error('Ошибка отправки обращения');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[500px] transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className={`w-16 h-16 rounded-full bg-red-100 flex items-center justify-center transition-all duration-500 ${
              isVisible ? 'scale-100 rotate-0' : 'scale-0 rotate-180'
            }`}>
              <Icon name="ShieldAlert" size={32} className="text-red-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Доступ заблокирован
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Ваш аккаунт был заблокирован администратором
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {blockReason && (
            <div className={`p-4 bg-red-50 border border-red-200 rounded-lg transition-all duration-300 delay-100 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex items-start gap-3">
                <Icon name="Info" size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-900 mb-1">Причина блокировки:</p>
                  <p className="text-sm text-red-700">{blockReason}</p>
                </div>
              </div>
            </div>
          )}

          <div className={`p-4 bg-blue-50 border border-blue-200 rounded-lg transition-all duration-300 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <div className="flex items-start gap-3">
              <Icon name="Mail" size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  Обратитесь к администратору
                </p>
                <p className="text-sm text-blue-700 mb-4">
                  Если вы считаете, что блокировка была ошибочной, отправьте обращение администратору. 
                  Ответ придёт на ваш email: <strong>{userEmail}</strong>
                </p>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="appeal-message" className="text-sm text-blue-900">
                      Ваше сообщение
                    </Label>
                    <Textarea
                      id="appeal-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Опишите ситуацию или задайте вопрос администратору..."
                      className="mt-1 min-h-[120px] resize-none"
                      disabled={sending}
                    />
                  </div>

                  <Button
                    onClick={handleSendAppeal}
                    disabled={sending || !message.trim()}
                    className="w-full"
                  >
                    {sending ? (
                      <>
                        <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      <>
                        <Icon name="Send" size={16} className="mr-2" />
                        Отправить обращение
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className={`flex justify-center transition-all duration-300 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                window.location.href = '/?logout=true';
              }}
            >
              <Icon name="LogOut" size={16} className="mr-2" />
              Вернуться к входу
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlockedUserDialog;