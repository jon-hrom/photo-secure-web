import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import funcUrls from '../../../backend/func2url.json';

interface ChangePasswordProps {
  userId: number;
}

const ChangePassword = ({ userId }: ChangePasswordProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [loading, setLoading] = useState(false);
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCode('');
    setStep('password');
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleInitiate = async () => {
    if (!oldPassword) {
      toast.error('Введите текущий пароль');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error('Новый пароль должен быть минимум 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    setLoading(true);

    try {
      const changePasswordUrl = funcUrls['change-password'];
      const response = await fetch(changePasswordUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          action: 'initiate',
          old_password: oldPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Код отправлен на email');
        setStep('code');
      } else {
        toast.error(data.error || 'Ошибка отправки кода');
      }
    } catch (error) {
      console.error('Change password initiate error:', error);
      toast.error('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!code || code.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }

    setLoading(true);

    try {
      const changePasswordUrl = funcUrls['change-password'];
      const response = await fetch(changePasswordUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          action: 'confirm',
          code: code,
          new_password: newPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Пароль успешно изменён');
        setIsOpen(false);
        resetForm();
      } else {
        toast.error(data.error || 'Ошибка подтверждения');
      }
    } catch (error) {
      console.error('Change password confirm error:', error);
      toast.error('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    resetForm();
  };

  return (
    <>
      <Button 
        variant="outline" 
        className="w-full flex items-center justify-center gap-2"
        onClick={() => setIsOpen(true)}
      >
        <Icon name="Lock" size={18} />
        Изменить пароль
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить пароль</DialogTitle>
            <DialogDescription>
              {step === 'password' 
                ? 'Введите текущий и новый пароль. Код подтверждения будет отправлен на email.'
                : 'Введите код подтверждения из письма'}
            </DialogDescription>
          </DialogHeader>

          {step === 'password' ? (
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Текущий пароль
                </label>
                <div className="relative">
                  <Input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Введите текущий пароль"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    <Icon name={showOldPassword ? 'EyeOff' : 'Eye'} size={18} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Новый пароль
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    <Icon name={showNewPassword ? 'EyeOff' : 'Eye'} size={18} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Подтвердите новый пароль
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Повторите новый пароль"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    <Icon name={showConfirmPassword ? 'EyeOff' : 'Eye'} size={18} />
                  </button>
                </div>
              </div>

              <Button 
                onClick={handleInitiate} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Отправка кода...
                  </>
                ) : (
                  'Отправить код на email'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Код подтверждения
                </label>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Введите 6-значный код"
                  disabled={loading}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Проверьте входящие письма и спам
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setStep('password')} 
                  disabled={loading}
                  className="flex-1"
                >
                  Назад
                </Button>
                <Button 
                  onClick={handleConfirm} 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Проверка...
                    </>
                  ) : (
                    'Подтвердить'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChangePassword;
