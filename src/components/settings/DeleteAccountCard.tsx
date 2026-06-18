import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const DELETE_USER_URL = 'https://functions.poehali.dev/9df9d28d-b7ea-448c-9d93-054c04b6a52b';

interface DeleteAccountCardProps {
  userId: string | number | null;
}

const DeleteAccountCard = ({ userId }: DeleteAccountCardProps) => {
  const [step, setStep] = useState<'closed' | 'warning' | 'code'>('closed');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  const reset = () => {
    setStep('closed');
    setCode('');
    setMaskedEmail('');
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
        body: JSON.stringify({ action: 'request_code', user_id: userId }),
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
              <DialogFooter className="flex-row gap-3 sm:justify-between">
                <Button
                  variant="outline"
                  className="flex-1 py-5 rounded-xl"
                  onClick={reset}
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
