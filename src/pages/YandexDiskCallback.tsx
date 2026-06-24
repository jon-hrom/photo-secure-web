import { useEffect, useState } from 'react';

export default function YandexDiskCallback() {
  const [message, setMessage] = useState('Подключаем Яндекс.Диск...');

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const error = params.get('error');

    if (token && window.opener) {
      window.opener.postMessage(
        { type: 'yandex-disk-token', token },
        window.location.origin
      );
      setMessage('Готово! Можно закрыть это окно.');
      setTimeout(() => {
        try { window.close(); } catch { /* noop */ }
      }, 800);
    } else if (error) {
      setMessage('Доступ к Яндекс.Диску не предоставлен. Закройте окно и попробуйте снова.');
    } else {
      setMessage('Не удалось получить доступ. Закройте окно и попробуйте снова.');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-100 p-6">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FC3F1D] mx-auto mb-4"></div>
        <p className="text-lg text-gray-700">{message}</p>
      </div>
    </div>
  );
}
