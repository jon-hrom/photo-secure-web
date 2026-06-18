import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { createTicket } from '@/components/support/supportTicketsApi';

const DELETE_USER_URL = 'https://functions.poehali.dev/9df9d28d-b7ea-448c-9d93-054c04b6a52b';
const ENERGY_URL = 'https://functions.poehali.dev/b78fe245-efbd-4bd0-8db1-2515e8dfafb6';

interface DeleteAccountCardProps {
  userId: string | number | null;
  userName?: string;
  userEmail?: string;
}

const DeleteAccountCard = ({ userId, userName, userEmail }: DeleteAccountCardProps) => {
  const [step, setStep] = useState<'closed' | 'warning' | 'code' | 'stay'>('closed');
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [stayMessage, setStayMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [energyBalance, setEnergyBalance] = useState<number>(0);

  useEffect(() => {
    if (step !== 'warning' || !userId) return;
    fetch(ENERGY_URL, { headers: { 'X-User-Id': String(userId) } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.energy_balance === 'number') {
          setEnergyBalance(data.energy_balance);
        }
      })
      .catch(() => {});
  }, [step, userId]);

  const reset = () => {
    setStep('closed');
    setCode('');
    setReason('');
    setStayMessage('');
    setMaskedEmail('');
  };

  const sendStayFeedback = async () => {
    if (!stayMessage.trim()) {
      reset();
      return;
    }
    if (!userId) {
      reset();
      return;
    }
    setLoading(true);
    try {
      const res = await createTicket(userId, {
        request_type: 'suggestion',
        priority: 'high',
        subject: 'Пользователь хотел удалить аккаунт, но остался',
        message: `Пользователь начал удаление аккаунта, но передумал.\n\nПожелание/причина:\n${stayMessage.trim()}`,
        user_name: userName || '',
        user_email: userEmail || '',
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Спасибо! Ваше сообщение отправлено в поддержку');
      reset();
    } catch {
      toast.error('Не удалось отправить сообщение. Попробуйте позже');
    } finally {
      setLoading(false);
    }
  };

  const requestCode = async () => {
    if (!userId) {
      toast.error('Не удалось определить пользователя');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(DELETE_USER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_code', user_id: userId, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Не удалось отправить код');
        return;
      }
      setMaskedEmail(data.email || '');
      setStep('code');
      toast.success('Код подтверждения отправлен на почту');
    } catch {
      toast.error('Ошибка сети. Попробуйте позже');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (code.trim().length !== 6) {
      toast.error('Введите 6-значный код из письма');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(DELETE_USER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', user_id: userId, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Не удалось удалить аккаунт');
        return;
      }
      toast.success('Аккаунт удалён');
      localStorage.clear();
      setTimeout(() => {
        window.location.href = '/';
      }, 1200);
    } catch {
      toast.error('Ошибка сети. Попробуйте позже');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setStep('warning')}
        variant="outline"
        className="w-full py-6 text-base sm:text-lg rounded-xl border-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:text-red-400"
      >
        <Icon name="Trash2" size={20} className="mr-2" />
        Удалить аккаунт
      </Button>

      <Dialog open={step !== 'closed'} onOpenChange={(open) => !open && reset()}>
        <DialogContent className="rounded-2xl">
          {step === 'warning' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500 text-xl font-extrabold">
                  <Icon name="TriangleAlert" size={24} />
                  Удаление аккаунта
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Подтверждение безвозвратного удаления аккаунта
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-4 text-red-700 dark:text-red-300 font-bold text-base leading-relaxed">
                Аккаунт будет удалён без возможности восстановления.
                Будут стёрты все данные, включая все фотографии в фотобанке
                и всю информацию профиля. Это действие необратимо.
              </div>
              {energyBalance > 0 && (
                <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 text-amber-800 dark:text-amber-300 leading-relaxed">
                  <div className="flex items-center gap-2 font-bold">
                    <Icon name="Zap" size={18} />
                    На балансе осталось {energyBalance} ед. энергии
                  </div>
                  <p className="text-sm mt-1">
                    При удалении аккаунта неизрасходованная энергия сгорает
                    без компенсации и возврату не подлежит (п. 5.11 Оферты).
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Расскажите, почему хотите удалить аккаунт?</label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ваш ответ поможет нам стать лучше (необязательно)"
                  rows={3}
                  className="rounded-xl resize-none"
                />
              </div>
              <DialogFooter className="flex-row gap-3 sm:justify-between">
                <Button
                  variant="outline"
                  className="flex-1 py-5 rounded-xl"
                  onClick={() => setStep('stay')}
                  disabled={loading}
                >
                  Нет
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 py-5 rounded-xl font-bold"
                  onClick={requestCode}
                  disabled={loading}
                >
                  {loading ? 'Отправляем код...' : 'Да, удалить'}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'stay' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <Icon name="Heart" size={22} className="text-primary" />
                  Спасибо, что остались с нами!
                </DialogTitle>
                <DialogDescription>
                  Поделитесь, что подтолкнуло вас к удалению аккаунта, но потом
                  вы передумали. Возможно, у вас есть пожелание — мы обязательно
                  его учтём.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={stayMessage}
                onChange={(e) => setStayMessage(e.target.value)}
                placeholder="Напишите ваши мысли или пожелания..."
                rows={4}
                className="rounded-xl resize-none"
              />
              <DialogFooter className="flex-row gap-3 sm:justify-between">
                <Button
                  variant="outline"
                  className="flex-1 py-5 rounded-xl"
                  onClick={reset}
                  disabled={loading}
                >
                  Закрыть
                </Button>
                <Button
                  className="flex-1 py-5 rounded-xl font-bold"
                  onClick={sendStayFeedback}
                  disabled={loading}
                >
                  <Icon name="Send" size={18} className="mr-2" />
                  {loading ? 'Отправляем...' : 'Отправить'}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'code' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <Icon name="Mail" size={22} className="text-primary" />
                  Подтверждение по почте
                </DialogTitle>
                <DialogDescription>
                  Мы отправили код подтверждения на {maskedEmail || 'вашу почту'}.
                  Введите его, чтобы окончательно удалить аккаунт.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="______"
                inputMode="numeric"
                className="text-center text-2xl tracking-[0.5em] font-bold h-14 rounded-xl"
              />
              <DialogFooter className="flex-row gap-3 sm:justify-between">
                <Button
                  variant="outline"
                  className="flex-1 py-5 rounded-xl"
                  onClick={reset}
                  disabled={loading}
                >
                  Отмена
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 py-5 rounded-xl font-bold"
                  onClick={confirmDelete}
                  disabled={loading}
                >
                  {loading ? 'Удаляем...' : 'Удалить навсегда'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeleteAccountCard;