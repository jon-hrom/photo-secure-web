export interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'navigate' | 'hover';
  page?: string;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  sectionTitle?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: 'Добро пожаловать!',
    description: 'Сейчас я покажу основные разделы приложения. Начнём с главной страницы',
    placement: 'bottom',
    page: 'dashboard',
    sectionTitle: '📊 Обзор приложения'
  },
  {
    target: 'nav',
    title: 'Навигация',
    description: 'В меню слева находятся все основные разделы. Давайте их изучим',
    placement: 'right',
    page: 'dashboard',
    action: 'hover',
    desktopOnly: true
  },
  {
    target: '[data-tour="clients-nav"]',
    title: 'Раздел «Клиенты»',
    description: 'Управляйте базой клиентов, добавляйте записи и отслеживайте проекты',
    placement: 'right',
    page: 'dashboard',
    action: 'click',
    sectionTitle: '👥 Работа с клиентами'
  },
  {
    target: '[data-tour="add-client"]',
    title: 'Добавить клиента',
    description: 'Нажмите, чтобы открыть форму создания нового клиента',
    placement: 'bottom',
    page: 'clients',
    action: 'click'
  },
  {
    target: '[data-tour="client-form"]',
    title: 'Форма клиента',
    description: 'Здесь вводите имя, контакты, адрес и ссылки на соц. сети',
    placement: 'bottom',
    page: 'clients'
  },
  {
    target: '[data-tour="client-card"]',
    title: 'Карточка клиента',
    description: 'Нажмите для деталей. На телефоне свайпайте влево/вправо для действий',
    placement: 'top',
    page: 'clients'
  },
  {
    target: '[data-tour="dashboard-nav"]',
    title: 'Вернёмся в главное меню',
    description: 'Теперь посмотрим другие разделы',
    placement: 'right',
    page: 'clients',
    action: 'click',
    desktopOnly: true
  },
  {
    target: '.mobile-nav-photobank',
    title: 'Мой фото банк',
    description: 'Загружайте фото, создавайте папки и управляйте файлами',
    placement: 'top',
    page: 'clients',
    action: 'navigate',
    mobileOnly: true,
    sectionTitle: '📸 Фото банк'
  },
  {
    target: '[data-tour="photobook-nav"]',
    title: 'Раздел «Фотокниги»',
    description: 'Создавайте дизайны фотокниг с автоматической раскладкой и 3D-превью',
    placement: 'right',
    page: 'dashboard',
    action: 'click',
    sectionTitle: '📚 Фотокниги',
    desktopOnly: true
  },
  {
    target: '[data-tour="upload-photos"]',
    title: 'Создание фотокниги',
    description: 'Загрузите фото, выберите шаблон и метод заполнения (авто или вручную)',
    placement: 'bottom',
    page: 'photobook'
  },
  {
    target: '[data-tour="dashboard-nav"]',
    title: 'Последний раздел',
    description: 'Вернёмся в меню для настроек',
    placement: 'right',
    page: 'photobook',
    action: 'click',
    desktopOnly: true
  },
  {
    target: '.mobile-nav-settings',
    title: 'Настройки',
    description: 'Управление профилем, безопасностью и подсказками',
    placement: 'top',
    page: 'photobook',
    action: 'navigate',
    mobileOnly: true,
    sectionTitle: '⚙️ Настройки'
  },
  {
    target: '[data-tour="settings-nav"]',
    title: 'Раздел «Настройки»',
    description: 'Управление профилем, двухфакторной аутентификацией и подсказками',
    placement: 'right',
    page: 'dashboard',
    action: 'click',
    desktopOnly: true,
    sectionTitle: '⚙️ Настройки'
  },
  {
    target: '[data-tour="hints-settings"]',
    title: 'Управление обучением',
    description: 'Отключите подсказки или перезапустите обучение в любой момент',
    placement: 'top',
    page: 'settings'
  }
];