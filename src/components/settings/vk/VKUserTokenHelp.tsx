import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const VK_APPS_URL = 'https://vk.com/editapp?act=create';

const VKUserTokenHelp = () => {
  const copyTemplate = async () => {
    await navigator.clipboard.writeText(
      'https://oauth.vk.com/authorize?client_id=ВАШ_ID&scope=messages,offline&redirect_uri=https://oauth.vk.com/blank.html&display=page&response_type=token&revoke=1',
    );
    toast.success('Шаблон скопирован — замените ВАШ_ID на номер вашего приложения');
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
        <Icon name="TriangleAlert" size={16} />
        Личная страница: нужен свой ключ ВК
      </p>

      <p className="text-sm text-muted-foreground">
        ВКонтакте больше не выдаёт доступ к личным сообщениям через чужие приложения — поэтому
        нужно создать своё. Это бесплатно и делается один раз за 5 минут.
      </p>

      <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
        <li>Нажмите кнопку ниже — откроется создание приложения ВК.</li>
        <li>Тип — <strong>«Веб-сайт»</strong>, адрес сайта: <code className="rounded bg-muted px-1">https://foto-mix.ru</code></li>
        <li>После создания откройте <strong>Настройки</strong> и скопируйте <strong>ID приложения</strong>.</li>
        <li>Скопируйте шаблон ссылки (вторая кнопка) и подставьте в неё свой ID.</li>
        <li>Откройте эту ссылку, нажмите <strong>«Разрешить»</strong>.</li>
        <li>Скопируйте <strong>весь адрес из адресной строки</strong> и вставьте в поле «Токен».</li>
      </ol>

      <div className="space-y-2">
        <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
          <a href={VK_APPS_URL} target="_blank" rel="noreferrer">
            <Icon name="ExternalLink" size={16} className="mr-2" />
            Создать приложение ВК
          </a>
        </Button>
        <Button variant="outline" className="w-full" onClick={copyTemplate}>
          <Icon name="Copy" size={16} className="mr-2" />
          Скопировать шаблон ссылки
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Проще вариант — подключить <strong>сообщество</strong>: там токен создаётся прямо в
        настройках группы, без отдельного приложения.
      </p>
    </div>
  );
};

export default VKUserTokenHelp;
