import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface FavoriteConfig {
  id: string;
  name: string;
  fields: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
}

interface ClientLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (clientData: { client_id: number; full_name: string; phone: string; email?: string; upload_enabled?: boolean }) => void;
  galleryCode: string;
  favoriteConfig?: FavoriteConfig | null;
}

export default function ClientLoginModal({ isOpen, onClose, onLogin, galleryCode, favoriteConfig }: ClientLoginModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 'login' — проверяем, есть ли такой клиент; 'register' — клиента нет, предлагаем создать профиль
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const isRegisterMode = mode === 'register';
  
  const showFullName = favoriteConfig?.fields.fullName !== false;
  const showPhone = favoriteConfig?.fields.phone !== false;
  const showEmail = favoriteConfig?.fields.email === true;

  if (!isOpen) return null;

  const normalizePhone = (raw: string): string => {
    let cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('8')) {
      cleaned = '+7' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && !cleaned.startsWith('+7')) {
      cleaned = '+7' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+7') && cleaned.length >= 10) {
      cleaned = '+7' + cleaned;
    }
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (showFullName && !fullName.trim()) {
      setError('Введите ФИО');
      return;
    }

    if (showPhone && !phone.trim()) {
      setError('Введите номер телефона');
      return;
    }

    setIsLoading(true);
    setError('');

    const normalizedPhone = showPhone ? normalizePhone(phone.trim()) : '';

    try {
      let result;

      if (isRegisterMode) {
        // Пользователь уже подтвердил создание профиля — регистрируем
        const regResponse = await fetch('https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register_client',
            gallery_code: galleryCode,
            full_name: fullName.trim(),
            phone: normalizedPhone,
            email: email.trim() || null
          })
        });
        const regResult = await regResponse.json();
        if (!regResponse.ok || !regResult.client_id) {
          throw new Error(regResult.error || 'Ошибка регистрации');
        }
        result = {
          client_id: regResult.client_id,
          full_name: fullName.trim(),
          phone: normalizedPhone,
          email: email.trim() || '',
          upload_enabled: regResult.upload_enabled || false
        };
      } else {
        const response = await fetch('https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            gallery_code: galleryCode,
            full_name: fullName.trim(),
            phone: normalizedPhone,
            email: email.trim() || null
          })
        });

        result = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            // Такого клиента нет — форма превращается в регистрацию,
            // введённые данные сохраняются
            setMode('register');
            setError('');
            setIsLoading(false);
            return;
          }
          throw new Error(result.error || 'Ошибка входа');
        }
      }

      onLogin({
        client_id: result.client_id,
        full_name: result.full_name,
        phone: result.phone,
        email: result.email,
        upload_enabled: result.upload_enabled || false
      });

      setFullName('');
      setPhone('');
      setEmail('');
      setError('');
      setMode('login');
      onClose();
    } catch (error) {
      console.error('[CLIENT_LOGIN] Error:', error);
      setError(error instanceof Error ? error.message : 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Icon
              name={isRegisterMode ? 'UserPlus' : 'User'}
              size={24}
              className={isRegisterMode ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}
            />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isRegisterMode ? 'Регистрация' : 'Вход'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <Icon name="X" size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {isRegisterMode ? (
          <div className="mb-6 rounded-lg border border-green-500/40 bg-green-50 dark:bg-green-900/20 p-3">
            <p className="text-sm text-green-800 dark:text-green-300">
              Такой клиент пока не найден. Проверьте данные и нажмите
              «Зарегистрироваться» — откроем вам личный кабинет.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Введите свои данные, чтобы войти в свой личный кабинет.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {showFullName && (
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
          )}

          {showPhone && (
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
          )}

          {showEmail && (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="example@mail.com"
              />
            </div>
          )}

          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isRegisterMode
              ? 'После регистрации ваши фото в избранном сохранятся за вами'
              : 'Если вы уже добавляли фото — укажите те же данные, чтобы открыть свой список избранного'}
          </p>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => (isRegisterMode ? setMode('login') : onClose())}
              className="flex-1"
            >
              {isRegisterMode ? 'Назад' : 'Отмена'}
            </Button>
            <Button 
              type="submit" 
              className={`flex-1 ${isRegisterMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              disabled={isLoading}
            >
              {isLoading ? 'Подождите...' : isRegisterMode ? 'Зарегистрироваться' : 'Продолжить'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}