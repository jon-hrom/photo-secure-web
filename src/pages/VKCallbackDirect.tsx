import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import funcUrls from '../../backend/func2url.json';

const VKCallbackDirect = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
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

    if (code && state) {
      const vkAuthUrl = funcUrls['vk-auth'];
      const params = new URLSearchParams({
        code,
        state,
        ...(deviceId && { device_id: deviceId }),
        ...(payload && { payload }),
        ...(hashPayload && !payload && { payload: hashPayload })
      });
      window.location.href = `${vkAuthUrl}?${params.toString()}`;
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-700">Обработка авторизации VK...</p>
      </div>
    </div>
  );
};

export default VKCallbackDirect;