import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import funcUrls from '../../backend/func2url.json';

const VKCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        toast.error('Некорректные параметры авторизации');
        navigate('/');
        return;
      }

      try {
        const vkAuthUrl = funcUrls['vk-auth'];
        const response = await fetch(`${vkAuthUrl}?code=${code}&state=${state}`);
        const data = await response.json();

        if (data.success && data.profile) {
          const { profile, user_id } = data;
          
          const userData = {
            user_id: user_id,
            vk_id: profile.sub,
            email: profile.email,
            name: profile.name,
            avatar: profile.picture,
            is_verified: profile.is_verified,
            phone: profile.phone_number
          };
          
          localStorage.setItem('vk_user', JSON.stringify(userData));
          localStorage.setItem('auth_token', data.session_id);

          toast.success(`Добро пожаловать, ${profile.name || 'пользователь'}!`);
          navigate('/');
        } else {
          toast.error(data.error || 'Ошибка авторизации');
          navigate('/');
        }
      } catch (error) {
        console.error('VK callback error:', error);
        toast.error('Ошибка обработки авторизации');
        navigate('/');
      } finally {
        setProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        {processing ? (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg text-gray-700">Обработка авторизации VK...</p>
          </>
        ) : (
          <p className="text-lg text-gray-700">Перенаправление...</p>
        )}
      </div>
    </div>
  );
};

export default VKCallback;