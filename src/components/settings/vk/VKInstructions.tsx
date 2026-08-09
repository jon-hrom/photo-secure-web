import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

const VKInstructions = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="outline" className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/20">
        <Icon name="BookOpen" size={18} className="mr-2" />
        Инструкция по подключению
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Как подключить ВКонтакте</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 text-sm leading-relaxed">
        <div className="space-y-2">
          <p className="font-semibold text-blue-700 dark:text-blue-300">Сообщество (группа)</p>
          <p className="text-muted-foreground">
            В сообществе откройте <strong>Управление → Работа с API → Ключи доступа</strong> и нажмите <strong>«Создать ключ»</strong>.
          </p>
          <p className="text-muted-foreground">Отметьте права:</p>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>Управление сообществом</li>
            <li>Сообщения сообщества</li>
            <li>Доступ к фотографиям</li>
            <li>Работа со стеной</li>
          </ul>
          <p className="text-muted-foreground">
            Затем в <strong>Управление → Сообщения</strong> включите «Сообщения сообщества».
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-blue-700 dark:text-blue-300">Личная страница</p>
          <p className="text-muted-foreground">
            Нужен токен вашей страницы с правом «Сообщения». Он тоже начинается с{' '}
            <code className="rounded bg-muted px-1">vk1.a...</code>. Добавьте подключение типа «Моя страница» и вставьте токен — ID указывать не нужно.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-blue-700 dark:text-blue-300">Важное правило ВКонтакте</p>
          <p className="text-muted-foreground">
            Ни группа, ни страница не могут написать человеку первыми. Клиент должен сам отправить вам хотя бы одно сообщение — для этого используйте кнопку «Пригласить в ВК» в карточке клиента.
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default VKInstructions;
