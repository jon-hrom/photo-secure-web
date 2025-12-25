import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import funcUrls from '../../backend/func2url.json';

const VKCallbackDirect = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const deviceId = searchParams.get('device_id');
    const payload = searchParams.get('payload');

    if (code && state) {
      const vkAuthUrl = funcUrls['vk-auth'];
      const params = new URLSearchParams({
        code,
        state,
        ...(deviceId && { device_id: deviceId }),
        ...(payload && { payload })
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