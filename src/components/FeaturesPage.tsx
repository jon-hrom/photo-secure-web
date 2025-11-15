import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const FeaturesPage = () => {
  const features = [
    {
      icon: 'Palette',
      title: 'Визуальный редактор сайта',
      description: 'Чтобы изменить и персонализировать шаблон'
    },
    {
      icon: 'ShoppingCart',
      title: 'Каталог товаров и корзина',
      description: 'С поиском и сортировкой'
    },
    {
      icon: 'LayoutDashboard',
      title: 'Кабинет продавца',
      description: 'Отображает заявки и оплаченные заказы'
    },
    {
      icon: 'CreditCard',
      title: 'Прием платежей',
      description: 'Онлайн и наличными через заявку'
    },
    {
      icon: 'Mail',
      title: 'Уведомления по почте',
      description: 'Никаких ручных напоминаний клиентам'
    },
    {
      icon: 'MapPin',
      title: 'Карточка в онлайн-картах',
      description: 'Реклама в геосервисах и сбор отзывов'
    },
    {
      icon: 'Star',
      title: 'Отзывы клиентов с карт',
      description: 'Автоматически подтягиваются на сайт'
    },
    {
      icon: 'MessageSquare',
      title: 'Форма обратной связи',
      description: 'Чтобы оставить заявку'
    },
    {
      icon: 'TrendingUp',
      title: 'SEO-оптимизация',
      description: 'Сайт продвигается в поисковиках'
    },
    {
      icon: 'Megaphone',
      title: 'Реклама через Я.Бизнес',
      description: 'Для продвижения в интернете'
    },
    {
      icon: 'Share2',
      title: 'Контакты и соцсети',
      description: 'Готовый блок с иконками ваших площадок'
    },
    {
      icon: 'Image',
      title: 'Фото, тексты, видео и ссылки',
      description: 'Ваш контент в красивой упаковке'
    },
    {
      icon: 'Shield',
      title: 'SSL-сертификат и защита от DDoS атак',
      description: 'Все для безопасности сайта'
    },
    {
      icon: 'Smartphone',
      title: 'Оптимизация под популярные устройства',
      description: 'Красиво на компьютере, планшете и смартфоне'
    },
    {
      icon: 'Sparkles',
      title: 'Полная персонализация шаблона',
      description: 'Настройте сайт под свой бренд'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Все возможности
          </span>
          {' '}сервиса
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Мы собрали всё необходимое для запуска и роста вашего бизнеса
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card 
            key={index} 
            className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card/50 backdrop-blur"
          >
            <CardContent className="p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Icon name={feature.icon as any} size={24} className="text-primary" />
              </div>
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FeaturesPage;