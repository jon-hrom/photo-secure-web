import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const TOKEN_URL =
  'https://oauth.vk.com/authorize?client_id=6121396&scope=messages,offline&redirect_uri=https://oauth.vk.com/blank.html&display=page&response_type=token&revoke=1';

const VKUserTokenHelp = () => (
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
      onClick={() => window.open(TOKEN_URL, '_blank', 'noopener')}
    >
      <Icon name="ExternalLink" size={16} className="mr-2" />
      Открыть страницу получения токена
    </Button>

    <p className="text-xs text-muted-foreground">
      Токен даёт доступ только к отправке сообщений. Пароль мы не видим и не храним.
    </p>
  </div>
);

export default VKUserTokenHelp;
