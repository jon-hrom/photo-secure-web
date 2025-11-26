import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const Tariffs = () => {
  const plans = [
    {
      name: 'Базовый',
      price: '0 ₽',
      period: 'бесплатно',
      features: [
        'До 100 фотографий',
        'Базовое хранилище',
        '1 активный клиент',
        'Поддержка по email'
      ],
      icon: 'Package'
    },
    {
      name: 'Профессиональный',
      price: '990 ₽',
      period: 'в месяц',
      features: [
        'До 5000 фотографий',
        'Расширенное хранилище',
        'Неограниченно клиентов',
        'Приоритетная поддержка',
        'Дополнительные инструменты'
      ],
      icon: 'Zap',
      popular: true
    },
    {
      name: 'Бизнес',
      price: '2990 ₽',
      period: 'в месяц',
      features: [
        'Неограниченно фотографий',
        'Премиум хранилище',
        'Неограниченно клиентов',
        'Персональный менеджер',
        'API доступ',
        'Брендирование'
      ],
      icon: 'Crown'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Тарифные планы</h1>
          <p className="text-gray-600">Выберите подходящий план для вашего бизнеса</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={`bg-white rounded-2xl shadow-lg p-6 relative ${
                plan.popular ? 'ring-2 ring-primary' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary text-white px-4 py-1 rounded-full text-sm font-medium">
                  Популярный
                </div>
              )}
              
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl">
                  <Icon name={plan.icon} size={24} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
              </div>

              <div className="mb-6">
                <div className="text-4xl font-bold text-gray-900">{plan.price}</div>
                <div className="text-gray-600">{plan.period}</div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Icon name="Check" size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className={`w-full ${plan.popular ? 'bg-gradient-to-r from-primary to-secondary' : ''}`}
                variant={plan.popular ? 'default' : 'outline'}
              >
                Выбрать план
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-gray-600 mb-4">Нужен индивидуальный план?</p>
          <Button variant="outline" className="gap-2">
            <Icon name="MessageCircle" size={18} />
            Связаться с нами
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Tariffs;
