import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface DashboardProps {
  userRole: 'user' | 'admin';
}

const Dashboard = ({ userRole }: DashboardProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [trialDaysLeft] = useState(14);
  const [subscriptionDaysLeft] = useState(0);
  const [balance] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const isTrialPeriod = trialDaysLeft > 0 && subscriptionDaysLeft === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-primary to-secondary text-white border-0 shadow-xl">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold mb-2">{formatTime(currentTime)}</h2>
              <p className="text-lg opacity-90 capitalize">{formatDate(currentTime)}</p>
            </div>
            <Icon name="Clock" size={64} className="opacity-30" />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="hover-scale transition-all shadow-lg border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Тарифный план</CardTitle>
              <Icon name="CreditCard" className="text-primary" size={24} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTrialPeriod ? (
              <>
                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  Пробный период
                </Badge>
                <div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Осталось дней:</span>
                    <span className="font-bold">{trialDaysLeft}</span>
                  </div>
                  <Progress value={(trialDaysLeft / 30) * 100} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Баланс: <span className="font-bold">{balance}₽</span> в месяц
                </p>
              </>
            ) : (
              <>
                <Badge className="bg-green-500 hover:bg-green-600 text-white">
                  Активная подписка
                </Badge>
                <div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Осталось дней:</span>
                    <span className="font-bold">{subscriptionDaysLeft}</span>
                  </div>
                  <Progress value={(subscriptionDaysLeft / 30) * 100} className="h-2" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover-scale transition-all shadow-lg border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Клиенты</CardTitle>
              <Icon name="Users" className="text-secondary" size={24} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">12</div>
            <p className="text-sm text-muted-foreground">Всего в базе</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>На этой неделе:</span>
                <span className="font-semibold">3</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>В этом месяце:</span>
                <span className="font-semibold">7</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-scale transition-all shadow-lg border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Фотокниги</CardTitle>
              <Icon name="Book" className="text-accent" size={24} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">5</div>
            <p className="text-sm text-muted-foreground">Проектов создано</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>В работе:</span>
                <span className="font-semibold">2</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Завершено:</span>
                <span className="font-semibold">3</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Icon name="Calendar" className="mr-2 text-primary" size={24} />
              Ближайшие встречи
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Иванова Мария', date: '15 ноября', time: '14:00', type: 'Фотосессия' },
              { name: 'Петров Сергей', date: '16 ноября', time: '16:30', type: 'Консультация' },
              { name: 'Смирнова Елена', date: '18 ноября', time: '10:00', type: 'Выдача фотокниги' },
            ].map((meeting, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Icon name="User" size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{meeting.name}</p>
                    <p className="text-sm text-muted-foreground">{meeting.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{meeting.date}</p>
                  <p className="text-sm text-muted-foreground">{meeting.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Icon name="TrendingUp" className="mr-2 text-secondary" size={24} />
              Статистика
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Завершённые проекты</span>
                <span className="font-bold">85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Загрузка календаря</span>
                <span className="font-bold">62%</span>
              </div>
              <Progress value={62} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Довольные клиенты</span>
                <span className="font-bold">98%</span>
              </div>
              <Progress value={98} className="h-2" />
            </div>
            {userRole === 'admin' && (
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Доход за месяц:</span>
                  <span className="text-2xl font-bold text-green-600">124,500₽</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
