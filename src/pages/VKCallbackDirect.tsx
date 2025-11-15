import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import funcUrls from '../../backend/func2url.json';

const VKCallbackDirect = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      const vkAuthUrl = funcUrls['vk-auth'];
      window.location.href = `${vkAuthUrl}?code=${code}&state=${state}`;
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
