import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface HelpSection {
  id: string;
  title: string;
  icon: string;
  items: {
    question: string;
    answer: string;
    image?: string;
  }[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Начало работы',
    icon: 'Rocket',
    items: [
      {
        question: 'Как зарегистрироваться и войти?',
        answer: 'Вы можете войти через Email, VK ID, Google или Яндекс. Для Email потребуется подтверждение почты. После входа вы попадёте на главную страницу с статистикой.',
      },
      {
        question: 'Что такое главная страница (Dashboard)?',
        answer: 'Главная страница показывает статистику: количество клиентов, проектов, встреч, ваш баланс и хранилище. Здесь также отображаются ближайшие встречи и быстрые действия.',
      },
      {
        question: 'Как пройти обучение заново?',
        answer: 'Перейдите в Настройки → Подсказки и советы → нажмите "Перезапустить обучение". Система проведёт вас по всем основным функциям приложения.',
      },
    ]
  },
  {
    id: 'clients',
    title: 'Управление клиентами',
    icon: 'Users',
    items: [
      {
        question: 'Как добавить нового клиента?',
        answer: 'Перейдите в раздел "Клиенты" и нажмите кнопку "+ Добавить клиента". Заполните имя, телефон, email, адрес и ссылку на соцсеть (VK). Все поля кроме имени необязательные.',
      },
      {
        question: 'Как редактировать или удалить клиента?',
        answer: 'Нажмите на карточку клиента для детальной информации. В открывшемся окне нажмите кнопку "Редактировать" или "Удалить".',
      },
      {
        question: 'Что такое свайпы на карточках клиентов?',
        answer: 'На мобильных устройствах свайпайте карточку клиента влево для быстрого удаления, или вправо для редактирования. Это быстрый способ управления без открытия деталей.',
      },
      {
        question: 'Как добавить запись к клиенту?',
        answer: 'Откройте карточку клиента и нажмите "Добавить запись". Укажите дату, время, тип встречи и дополнительные заметки. Записи отображаются в календаре и на главной странице.',
      },
      {
        question: 'Как отправить сообщение клиенту?',
        answer: 'В карточке клиента нажмите кнопку с иконкой сообщения. Если у клиента указан VK профиль, откроется диалог ВКонтакте. Если указан email, откроется почтовый клиент.',
      },
      {
        question: 'Как экспортировать список клиентов?',
        answer: 'На странице "Клиенты" нажмите кнопку "Экспорт". Выберите формат (CSV или JSON) и скачайте файл со всеми данными клиентов.',
      },
    ]
  },
  {
    id: 'photobank',
    title: 'Мой фото банк',
    icon: 'Images',
    items: [
      {
        question: 'Как загрузить фотографии?',
        answer: 'Перейдите в "Мой фото банк" через меню. Нажмите "Загрузить фото" или перетащите файлы в зону загрузки. Можно загружать сразу несколько файлов. Поддерживаются форматы: JPG, PNG, WEBP, HEIC.',
      },
      {
        question: 'Как организовать фото по папкам?',
        answer: 'Нажмите "Создать папку", введите название. Затем загружайте фото в выбранную папку. Можно переключаться между папками через боковое меню.',
      },
      {
        question: 'Как удалить фотографии?',
        answer: 'Включите режим выбора (галочка в углу), отметьте нужные фото и нажмите "Удалить". Фото переместятся в корзину, где хранятся 30 дней, затем удаляются автоматически.',
      },
      {
        question: 'Как восстановить фото из корзины?',
        answer: 'Перейдите в "Корзина" через меню фото банка. Выберите фото и нажмите "Восстановить". Фото вернётся в ту папку, откуда было удалено.',
      },
      {
        question: 'Сколько места доступно для хранения?',
        answer: 'Лимит хранилища зависит от вашего тарифа. Текущее использование отображается в правом верхнем углу фото банка. При превышении лимита загрузка новых файлов будет заблокирована.',
      },
    ]
  },
  {
    id: 'photobooks',
    title: 'Фотокниги',
    icon: 'Book',
    items: [
      {
        question: 'Как создать фотокнигу?',
        answer: 'Перейдите в "Фотокниги" → "Создать фотокнигу". Загрузите фото, выберите шаблон (20×20, 20×30, 30×30), метод заполнения (автоматический или вручную) и количество разворотов (10, 20 или 30).',
      },
      {
        question: 'В чём разница между автоматическим и ручным режимом?',
        answer: 'Автоматический режим использует AI для распознавания лиц и оптимального размещения фото. Ручной режим позволяет самостоятельно перетаскивать фото в нужные ячейки сетки.',
      },
      {
        question: 'Как посмотреть 3D-превью фотокниги?',
        answer: 'После создания дизайна нажмите на него в списке. Откроется 3D-просмотр, где можно листать развороты, вращать книгу и оценить финальный вид.',
      },
      {
        question: 'Как поделиться фотокнигой с клиентом?',
        answer: 'При создании фотокниги включите опцию "Разрешить клиенту просматривать". Система сгенерирует уникальную ссылку, которую можно отправить клиенту для просмотра без регистрации.',
      },
      {
        question: 'Как скачать или заказать фотокнигу?',
        answer: 'В 3D-превью нажмите "Скачать PDF" для сохранения макета. Для заказа печати нажмите "Заказать печать" — откроется форма заказа с выбором типографии и доставки.',
      },
    ]
  },
  {
    id: 'settings',
    title: 'Настройки и безопасность',
    icon: 'Settings',
    items: [
      {
        question: 'Как изменить контактные данные?',
        answer: 'Перейдите в Настройки → Контактная информация. Здесь можно изменить email и телефон. После изменения потребуется подтверждение через код.',
      },
      {
        question: 'Что такое двухфакторная аутентификация (2FA)?',
        answer: '2FA добавляет дополнительный уровень защиты. При входе потребуется не только пароль, но и код из email. Включите в Настройки → Безопасность → Двухфакторная аутентификация.',
      },
      {
        question: 'Как изменить пароль?',
        answer: 'Настройки → Безопасность → Изменить пароль. Введите текущий пароль и новый (минимум 8 символов). Доступно только для пользователей, зарегистрированных через email.',
      },
      {
        question: 'Как управлять подсказками?',
        answer: 'Настройки → Подсказки и советы. Здесь можно отключить все подсказки, перезапустить обучение или полностью отключить систему обучения.',
      },
      {
        question: 'Как подтвердить email?',
        answer: 'На главной странице появится уведомление с кнопкой "Подтвердить". Нажмите её, введите код из письма. После подтверждения появится синяя галочка рядом с именем.',
      },
    ]
  },
  {
    id: 'tariffs',
    title: 'Тарифы и подписка',
    icon: 'Zap',
    items: [
      {
        question: 'Какие тарифы доступны?',
        answer: 'Доступны 3 тарифа: Базовый (бесплатно, 1 ГБ, 50 клиентов), Стандарт (299₽/мес, 10 ГБ, 200 клиентов), Профессионал (599₽/мес, 50 ГБ, безлимит клиентов).',
      },
      {
        question: 'Как сменить тариф?',
        answer: 'Перейдите в раздел "Тарифы", выберите подходящий план и нажмите "Выбрать". Оплатите через удобный способ (карта, СБП, криптовалюта). Тариф активируется сразу после оплаты.',
      },
      {
        question: 'Есть ли пробный период?',
        answer: 'Да, новым пользователям доступно 14 дней пробного периода на тарифе "Стандарт". После окончания можно продолжить с оплатой или перейти на базовый план.',
      },
      {
        question: 'Как работает автопродление?',
        answer: 'Подписка автоматически продлевается в конце периода. Отключить автопродление можно в Настройки → Подписка. Уведомление о списании придёт за 3 дня до даты.',
      },
    ]
  },
  {
    id: 'mobile',
    title: 'Мобильная версия',
    icon: 'Smartphone',
    items: [
      {
        question: 'Как работает нижнее меню на телефоне?',
        answer: 'Нажмите на кнопку "Главная" в нижнем меню для перехода. Свайпните вверх или нажмите на кнопку, чтобы раскрыть все разделы: Настройки, Фото банк, Клиенты, Тарифы.',
      },
      {
        question: 'Как использовать свайпы?',
        answer: 'Свайп влево/вправо на карточке клиента открывает быстрые действия. Свайп вверх на меню раскрывает полный список навигации. Это экономит время на телефоне.',
      },
      {
        question: 'Работает ли приложение офлайн?',
        answer: 'Базовый просмотр данных доступен офлайн (если данные уже загружены). Для загрузки фото, создания клиентов и фотокниг требуется интернет.',
      },
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Решение проблем',
    icon: 'AlertCircle',
    items: [
      {
        question: 'Не приходит код подтверждения на email',
        answer: 'Проверьте папку "Спам". Попробуйте запросить код повторно через 1 минуту. Если не помогло, свяжитесь с поддержкой через форму обратной связи.',
      },
      {
        question: 'Фото загружаются очень медленно',
        answer: 'Проверьте скорость интернета. Загружайте фото меньшими пакетами (до 50 штук). При слабом соединении используйте формат WEBP вместо PNG для экономии трафика.',
      },
      {
        question: 'Не могу войти в аккаунт',
        answer: 'Проверьте правильность email и пароля. Используйте "Забыли пароль?" для восстановления. Если входили через VK/Google, используйте тот же способ входа.',
      },
      {
        question: 'Пропали данные после обновления',
        answer: 'Все данные хранятся в облаке и не удаляются при обновлении. Попробуйте перезайти в аккаунт. Если проблема осталась, напишите в поддержку с указанием email.',
      },
    ]
  },
];

const HelpPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string>('getting-started');

  const filteredSections = HELP_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

  const handleStartTour = () => {
    localStorage.removeItem('onboardingTourCompleted');
    localStorage.removeItem('onboardingTourDisabled');
    window.location.reload();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg">
            <Icon name="BookOpen" size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Справочный центр</h1>
            <p className="text-muted-foreground">Полное руководство по работе с Foto-Mix</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Icon name="Search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по вопросам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <Icon name="GraduationCap" size={24} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">Пройдите интерактивное обучение</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Мы проведём вас по всем основным функциям приложения за 2 минуты
                </p>
                <Button onClick={handleStartTour} className="rounded-full">
                  <Icon name="Play" size={16} className="mr-2" />
                  Начать обучение
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {filteredSections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon name="SearchX" size={48} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Ничего не найдено по запросу "{searchQuery}"
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredSections.map(section => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon name={section.icon} size={20} className="text-primary" />
                  </div>
                  {section.title}
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {section.items.length} {section.items.length === 1 ? 'вопрос' : 'вопросов'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible value={expandedSection} onValueChange={setExpandedSection}>
                  {section.items.map((item, index) => (
                    <AccordionItem key={`${section.id}-${index}`} value={`${section.id}-${index}`}>
                      <AccordionTrigger className="text-left hover:no-underline">
                        <div className="flex items-start gap-2">
                          <Icon name="HelpCircle" size={18} className="text-primary mt-0.5 flex-shrink-0" />
                          <span>{item.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pl-6 text-muted-foreground">
                          {item.answer}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Icon name="MessageCircle" size={24} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">Не нашли ответ?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Свяжитесь с нашей службой поддержки, и мы поможем решить любой вопрос
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full">
                  <Icon name="Mail" size={16} className="mr-2" />
                  support@foto-mix.ru
                </Button>
                <Button variant="outline" className="rounded-full">
                  <Icon name="Send" size={16} className="mr-2" />
                  Telegram
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HelpPage;
