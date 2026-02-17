import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

const TelegramCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Авторизация через Telegram...');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Токен авторизации не найден');
      return;
    }

    const exchangeToken = async () => {
      try {
        const response = await fetch(
          'https://functions.poehali.dev/d75023e4-464a-4aad-9456-a7417376a901?action=callback',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Ошибка авторизации');
        }

        const userId = data.userId || data.user?.id;
        const userEmail = data.user?.email || '';
        
        localStorage.setItem('auth_token', data.token);
        if (data.session_id) {
          localStorage.setItem('auth_session_id', data.session_id);
        }
        localStorage.setItem('userId', userId.toString());
        
        const ADMIN_EMAILS = ['jonhrom2012@gmail.com'];
        const isAdmin = ADMIN_EMAILS.includes(userEmail);
        
        const authSession = {
          isAuthenticated: true,
          userId: userId,
          userEmail: userEmail,
          isAdmin: isAdmin,
          currentPage: 'dashboard',
          lastActivity: Date.now(),
        };
        localStorage.setItem('authSession', JSON.stringify(authSession));

        setStatus('success');
        setMessage('Успешная авторизация!');
        toast.success('Вход выполнен через Telegram');

        // Перенаправляем на главную с перезагрузкой для восстановления сессии
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } catch (error: any) {
        console.error('Token exchange error:', error);
        setStatus('error');
        setMessage(error.message || 'Ошибка авторизации');
        toast.error(error.message || 'Не удалось выполнить вход');
        
        // Перенаправляем на страницу входа через 3 секунды
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    };

    exchangeToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-50/30 to-blue-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckCircle2" className="text-green-600" size={32} />
            </div>
            <p className="text-lg font-semibold text-green-600 mb-2">{message}</p>
            <p className="text-sm text-muted-foreground">Перенаправление...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <Icon name="XCircle" className="text-red-600" size={32} />
            </div>
            <p className="text-lg font-semibold text-red-600 mb-2">Ошибка авторизации</p>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="text-primary hover:underline text-sm"
            >
              Вернуться к входу
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TelegramCallback;