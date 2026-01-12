import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const ShortLink = () => {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'error' | 'expired'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAndRedirect = async () => {
      if (!code) {
        setStatus('error');
        setError('Код не указан');
        return;
      }

      try {
        const response = await fetch(
          `https://functions.poehali.dev/c7c9c0c2-b26f-442d-ad1c-dd7c3185ac44?code=${code}`
        );

        if (!response.ok) {
          if (response.status === 410) {
            setStatus('expired');
            return;
          }
          throw new Error('Ссылка не найдена');
        }

        const data = await response.json();
        
        if (data.photo_path) {
          setStatus('redirecting');
          // Редирект на оригинальную ссылку S3
          const fullUrl = `https://storage.yandexcloud.net/foto-mix/${data.photo_path}`;
          window.location.href = fullUrl;
        } else {
          throw new Error('Некорректный ответ сервера');
        }
      } catch (err) {
        console.error('Redirect error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      }
    };

    fetchAndRedirect();
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Загрузка...
            </h2>
          </>
        )}

        {status === 'redirecting' && (
          <>
            <div className="animate-pulse mb-4">
              <svg className="w-16 h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Перенаправление...
            </h2>
          </>
        )}

        {status === 'expired' && (
          <>
            <svg className="w-16 h-16 mx-auto text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Ссылка истекла
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Срок действия этой ссылки истёк
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Ошибка
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {error || 'Не удалось загрузить фото'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ShortLink;
