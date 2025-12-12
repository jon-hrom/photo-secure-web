import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

const SmsBalanceManager = () => {
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Тестовое сообщение от foto-mix.ru');

  const checkBalance = async () => {
    setLoading(true);
    try {
      // SMS.SU API для проверки баланса (через тестовую отправку)
      const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-sms-balance'
        })
      });

      const data = await response.json();
      
      if (data.ok && typeof data.balance === 'number') {
        setBalance(data.balance);
        toast.success(`Баланс: ${data.balance.toFixed(2)} руб.`);
      } else {
        // SMS.SU API doesn't support direct balance check
        toast.info('SMS.SU не поддерживает прямую проверку баланса. Используйте тестовую отправку для проверки баланса.', {
          duration: 5000
        });
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const sendTestSms = async () => {
    if (!testPhone) {
      toast.error('Введите номер телефона');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-sms',
          phone: testPhone,
          text: testMessage,
          priority: 2
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        const oldBalance = balance;
        const newBalance = data.credits || balance;
        
        if (oldBalance !== null && Math.abs(oldBalance - newBalance) < 0.01) {
          toast.warning('⚠️ SMS принято SMS.SU, но баланс не изменился! Это означает недостаточно средств для реальной отправки. Пополните баланс.', {
            duration: 7000
          });
        } else {
          toast.success(`✅ SMS отправлено! Новый баланс: ${newBalance.toFixed(2)} руб.`);
        }
        
        if (data.credits) {
          setBalance(data.credits);
        }
        await checkBalance();
      } else {
        toast.error(data.error || 'Ошибка отправки SMS');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  // Removed auto balance check on mount since SMS.SU doesn't support it
  // Balance will be updated after sending test SMS

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Icon name="Smartphone" className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <CardTitle>Управление SMS</CardTitle>
            <CardDescription>Баланс SMS.SU и отправка тестовых сообщений</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Баланс */}
        <div className={`p-4 rounded-lg border ${
          balance !== null && balance < 100 
            ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200' 
            : balance !== null 
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
            : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon name="Wallet" className={`h-5 w-5 ${
                balance !== null && balance < 100 ? 'text-red-600' : balance !== null ? 'text-green-600' : 'text-gray-400'
              }`} />
              <span className="font-semibold text-gray-700">Баланс SMS.SU</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkBalance}
              disabled={loading}
              title="SMS.SU не поддерживает прямую проверку баланса"
            >
              <Icon name="Info" className="h-4 w-4" />
            </Button>
          </div>
          {balance !== null ? (
            <>
              <div className={`text-3xl font-bold ${
                balance < 10 ? 'text-red-600' : 'text-green-600'
              }`}>
                {balance.toFixed(2)} ₽
              </div>
              {balance < 100 && (
                <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
                  <Icon name="AlertCircle" className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Недостаточно средств!</strong> SMS.SU принимает запросы, но не отправляет SMS реально. 
                    Пополните баланс минимум на 100 руб.
                  </span>
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                Баланс обновлен: {new Date().toLocaleTimeString('ru-RU')}
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <div className="text-gray-400">Баланс не проверен</div>
              <div className="text-xs text-gray-500">
                Отправьте тестовую SMS для проверки баланса
              </div>
            </div>
          )}
          <div className="mt-2 text-xs text-gray-500">
            1 SMS сегмент ≈ 3-4 руб. (до 70 символов)
          </div>
        </div>

        {/* Инструкция по пополнению */}
        <Alert variant={balance !== null && balance < 100 ? 'destructive' : 'default'}>
          <Icon name={balance !== null && balance < 100 ? 'AlertTriangle' : 'Info'} className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">
                {balance !== null && balance < 100 
                  ? '⚠️ Рекомендуем пополнить баланс!' 
                  : 'Как пополнить баланс SMS.SU:'}
              </p>
              {balance !== null && balance < 100 && (
                <p className="text-sm">
                  При балансе ниже 100 руб. рекомендуется пополнить счет. 
                  SMS.SU может возвращать успешные ответы (err_code: 0), 
                  но <strong>не отправлять SMS реально</strong> при недостаточных средствах.
                </p>
              )}
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Перейдите на сайт <a href="https://sms.su/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">sms.su</a></li>
                <li>Войдите в личный кабинет с вашим API ключом</li>
                <li>Выберите раздел "Пополнить баланс"</li>
                <li>Выберите способ оплаты (карта, Яндекс.Деньги и др.)</li>
                <li>Минимальная сумма пополнения: 100 руб.</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                После пополнения обновите баланс на этой странице
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Быстрый переход на SMS.SU */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.open('https://sms.su/', '_blank')}
          >
            <Icon name="ExternalLink" className="h-4 w-4 mr-2" />
            Личный кабинет SMS.SU
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.open('https://sms.su/api', '_blank')}
          >
            <Icon name="FileText" className="h-4 w-4 mr-2" />
            Документация API
          </Button>
        </div>

        {/* Тестовая отправка */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <Icon name="TestTube" className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold">Тестовая отправка SMS</h3>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="test-phone">Номер телефона</Label>
            <Input
              id="test-phone"
              type="tel"
              placeholder="+7 (900) 123-45-67"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-message">Текст сообщения</Label>
            <Input
              id="test-message"
              type="text"
              placeholder="Текст SMS"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              maxLength={70}
            />
            <p className="text-xs text-muted-foreground">
              {testMessage.length}/70 символов (1 сегмент)
            </p>
          </div>

          <Button
            onClick={sendTestSms}
            disabled={loading || !testPhone}
            className="w-full"
          >
            <Icon name="Send" className="h-4 w-4 mr-2" />
            {loading ? 'Отправка...' : 'Отправить тестовую SMS'}
          </Button>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Цена за сегмент</div>
            <div className="text-lg font-bold text-blue-600">~3-4 ₽</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Символов в сегменте</div>
            <div className="text-lg font-bold text-purple-600">до 70</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SmsBalanceManager;