import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const VK_ACCOUNTS_API = 'https://functions.poehali.dev/52780632-e8cf-495e-a573-78e5eeea2ef9';

const VKUserTokenHelp = () => {
  const [authUrl, setAuthUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const res = await fetch(VK_ACCOUNTS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
          body: JSON.stringify({ action: 'auth_url' }),
        });
        const data = await res.json();
        if (data.success) setAuthUrl(data.auth_url);
      } catch {
        // ссылку покажем как недоступную
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const copyLink = async () => {
    await navigator.clipboard.writeText(authUrl);
    toast.success('Ссылка скопирована — вставьте её в адресную строку браузера');
  };

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
      <p className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
        <Icon name="HelpCircle" size={16} />
        Где взять токен своей страницы
      </p>

      <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
        <li>Войдите во ВКонтакте в этом же браузере.</li>
        <li>Нажмите синюю кнопку ниже — откроется страница ВК.</li>
        <li>Нажмите <strong>«Разрешить»</strong>.</li>
        <li>
          Откроется пустая белая страница — это нормально. Скопируйте{' '}
          <strong>весь адрес из адресной строки</strong> браузера.
        </li>
        <li>Вставьте его в поле «Токен» ниже — нужное система возьмёт сама.</li>
      </ol>

      {loading ? (
        <Button className="w-full" disabled>
          <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
          Готовлю ссылку...
        </Button>
      ) : authUrl ? (
        <div className="space-y-2">
          <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
            <a href={authUrl} target="_blank" rel="noreferrer">
              <Icon name="ExternalLink" size={16} className="mr-2" />
              Открыть страницу получения токена
            </a>
          </Button>
          <Button variant="outline" className="w-full" onClick={copyLink}>
            <Icon name="Copy" size={16} className="mr-2" />
            Не открылось? Скопировать ссылку
          </Button>
        </div>
      ) : (
        <p className="text-sm text-red-600">
          Не удалось подготовить ссылку. Обновите страницу и попробуйте снова.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Токен даёт доступ только к отправке сообщений. Пароль мы не видим и не храним.
      </p>
    </div>
  );
};

export default VKUserTokenHelp;
