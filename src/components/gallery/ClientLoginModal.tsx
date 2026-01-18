import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface ClientLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (clientData: { client_id: number; full_name: string; phone: string; email?: string }) => void;
  galleryCode: string;
}

export default function ClientLoginModal({ isOpen, onClose, onLogin, galleryCode }: ClientLoginModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      setError('Введите ФИО');
      return;
    }

    if (!phone.trim()) {
      setError('Введите номер телефона');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          gallery_code: galleryCode,
          full_name: fullName,
          phone: phone
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setError('Клиент с таким ФИО не найден. Добавьте фото в избранное, чтобы создать профиль.');
        } else {
          throw new Error(result.error || 'Ошибка входа');
        }
        return;
      }

      onLogin({
        client_id: result.client_id,
        full_name: result.full_name,
        phone: result.phone,
        email: result.email
      });

      setFullName('');
      setPhone('');
      setError('');
      onClose();
    } catch (error) {
      console.error('[CLIENT_LOGIN] Error:', error);
      setError(error instanceof Error ? error.message : 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Icon name="User" size={24} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Вход</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Введите ФИО и телефон для доступа к вашим избранным фото
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">ФИО <span className="text-red-500">*</span></Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setError('');
              }}
              placeholder="Иванов Иван Иванович"
              className={error && !phone.trim() ? '' : (error ? 'border-red-500' : '')}
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="phone">Телефон <span className="text-red-500">*</span></Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError('');
              }}
              placeholder="+7 (900) 123-45-67"
              className={error && fullName.trim() ? 'border-red-500' : ''}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <p className="text-xs text-gray-500">
            Введите данные, которые вы указали при добавлении фото в избранное
          </p>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}