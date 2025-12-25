import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import funcUrls from '../../backend/func2url.json';

const VKCallbackDirect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      // VK ID возвращает параметры в query string
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const deviceId = searchParams.get('device_id');
      const payload = searchParams.get('payload');

      // Также проверяем hash fragment (для payload)
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      const hashPayload = hashParams.get('payload');

      console.log('[VK Callback] Query params:', { code, state, deviceId, payload });
      console.log('[VK Callback] Hash params:', { payload: hashPayload });

      if (!code || !state) {
        console.error('[VK Callback] Missing code or state');
        toast.error('Некорректные параметры авторизации');
        navigate('/');
        return;
      }

      try {
        // Вызываем backend ОДИН РАЗ
        const vkAuthUrl = funcUrls['vk-auth'];
        const params = new URLSearchParams({
          code,
          state,
          ...(deviceId && { device_id: deviceId }),
          ...(payload && { payload }),
          ...(hashPayload && !payload && { payload: hashPayload })
        });

        console.log('[VK Callback] Calling backend:', `${vkAuthUrl}?${params.toString()}`);
        const response = await fetch(`${vkAuthUrl}?${params.toString()}`);
        const data = await response.json();

        console.log('[VK Callback] Backend response:', data);

        if (response.status === 403 && data.blocked) {
          toast.error(data.message || 'Ваш аккаунт заблокирован');
          navigate('/');
          return;
        }

        if (data.success && (data.profile || data.userData)) {
          const profile = data.profile || data.userData;
          const user_id = data.user_id;

          const userData = {
            user_id: user_id,
            vk_id: profile.vk_id || profile.sub,
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar || profile.picture,
            verified: profile.verified || profile.is_verified || false,
            phone: profile.phone || profile.phone_number
          };

          console.log('[VK Callback] Saving to localStorage:', userData);
          localStorage.setItem('vk_user', JSON.stringify(userData));
          localStorage.setItem('auth_token', data.token || data.session_id);
          localStorage.setItem('userId', user_id.toString());

          toast.success(`Добро пожаловать, ${profile.name || 'пользователь'}!`);

          // Даём время на сохранение перед редиректом
          await new Promise(resolve => setTimeout(resolve, 100));
          navigate('/');
        } else {
          console.error('[VK Callback] Auth failed:', data);
          toast.error(data.error || 'Ошибка авторизации');
          navigate('/');
        }
      } catch (error) {
        console.error('[VK Callback] Exception:', error);
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

export default VKCallbackDirect;