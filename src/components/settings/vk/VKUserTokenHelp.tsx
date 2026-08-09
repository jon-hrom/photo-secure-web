import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const VK_ACCOUNTS_API = 'https://functions.poehali.dev/52780632-e8cf-495e-a573-78e5eeea2ef9';

const VKUserTokenHelp = () => {
  const [loading, setLoading] = useState(false);

  const openAuth = async () => {
    setLoading(true);
    const tab = window.open('', '_blank', 'noopener');
    try {
      const userId = localStorage.getItem('userId');
      const res = await fetch(VK_ACCOUNTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ action: 'auth_url' }),
      });
      const data = await res.json();
      if (data.success && tab) {
        tab.location.href = data.auth_url;
      } else {
        tab?.close();
        toast.error(data.error || 'Не удалось открыть страницу ВК');
      }
    } catch {
      tab?.close();
      toast.error('Не удалось открыть страницу ВК');
    } finally {
      setLoading(false);
    }
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

      <Button
        type="button"
        className="w-full bg-blue-600 hover:bg-blue-700"
        onClick={openAuth}
        disabled={loading}
      >
        {loading ? (
          <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
        ) : (
          <Icon name="ExternalLink" size={16} className="mr-2" />
        )}
        Открыть страницу получения токена
      </Button>

      <p className="text-xs text-muted-foreground">
        Токен даёт доступ только к отправке сообщений. Пароль мы не видим и не храним.
      </p>
    </div>
  );
};

export default VKUserTokenHelp;
