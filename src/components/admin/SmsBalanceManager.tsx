import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const SmsBalanceManager = () => {
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [testPhone, setTestPhone] = useState('');

  const checkBalance = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-sms-balance' })
      });

      const data = await response.json();
      
      if (data.ok && typeof data.balance === 'number') {
        setBalance(data.balance);
        toast.success(`${data.balance.toFixed(2)} ₽`);
      } else {
        toast.error(data.error || 'Ошибка');
      }
    } catch {
      toast.error('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const sendTestSms = async () => {
    if (!testPhone) {
      toast.error('Введите телефон');
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
          text: 'Код подтверждения: 123456',
          priority: 2
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        toast.success('SMS отправлено!');
        if (data.credits) setBalance(data.credits);
        await checkBalance();
      } else {
        toast.error(data.error || 'Ошибка');
      }
    } catch {
      toast.error('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBalance();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Smartphone" className="h-5 w-5" />
          SMS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Баланс */}
        <div className={`p-4 rounded-lg ${
          balance !== null && balance < 10 
            ? 'bg-red-50 border border-red-200' 
            : 'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Баланс</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkBalance}
              disabled={loading}
              className="h-7 px-2"
            >
              <Icon name="RefreshCw" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className={`text-2xl font-bold ${
            balance !== null && balance < 10 ? 'text-red-600' : 'text-green-600'
          }`}>
            {balance !== null ? `${balance.toFixed(2)} ₽` : '—'}
          </div>
          {balance !== null && balance < 10 && (
            <div className="mt-2 text-xs text-red-600 flex items-start gap-1">
              <Icon name="AlertCircle" className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Пополните на <a href="https://sms.su" target="_blank" rel="noopener" className="underline font-semibold">sms.su</a></span>
            </div>
          )}
        </div>

        {/* Тестовая отправка */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Тест SMS</label>
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder="+7 900 123-45-67"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={sendTestSms}
              disabled={loading || !testPhone}
              size="sm"
            >
              <Icon name="Send" className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Отправка: "Код подтверждения: 123456"
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SmsBalanceManager;
