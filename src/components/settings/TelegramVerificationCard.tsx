import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Loader2 } from 'lucide-react';

interface TelegramVerificationCardProps {
  userId: number;
}

const TelegramVerificationCard: React.FC<TelegramVerificationCardProps> = ({ userId }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const verifyUrl = 'https://functions.poehali.dev/46d9b487-dbc7-4472-a333-3b30ed8d2733';

  useEffect(() => {
    checkVerificationStatus();
  }, [userId]);

  const checkVerificationStatus = async () => {
    try {
      const response = await fetch(`${verifyUrl}?action=check&user_id=${userId}`);
      const data = await response.json();
      setIsVerified(data.verified);
    } catch (err) {
      console.error('Error checking verification:', err);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('7') || cleaned.startsWith('8')) {
      return '+7' + cleaned.slice(1);
    }
    if (!cleaned.startsWith('+')) {
      return '+' + cleaned;
    }
    return '+' + cleaned;
  };

  const handleGenerateCode = async () => {
    setError('');

    if (!phoneNumber || phoneNumber.length < 11) {
      setError('Введите корректный номер телефона');
      return;
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    setIsLoading(true);
    try {
      const response = await fetch(`${verifyUrl}?action=generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          phone_number: formattedPhone
        })
      });

      const data = await response.json();

      if (response.ok) {
        setCode(data.code);
        setIsCodeSent(true);
      } else {
        setError(data.error || 'Ошибка генерации кода');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${verifyUrl}?action=check&user_id=${userId}`);
      const data = await response.json();

      if (data.verified) {
        setIsVerified(true);
        localStorage.removeItem(`telegram_banner_dismissed_${userId}`);
      } else {
        setError('Привязка ещё не подтверждена. Отправьте код боту @FotooMixx_bot');
      }
    } catch (err) {
      setError('Ошибка проверки верификации');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerified) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Icon name="CheckCircle2" size={20} />
            Telegram подключен
          </CardTitle>
          <CardDescription className="text-green-600 dark:text-green-500">
            Вы будете получать уведомления в Telegram
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl text-gray-900 dark:text-white">
          <Icon name="MessageCircle" size={20} className="md:w-6 md:h-6" />
          Уведомления через Telegram
        </CardTitle>
        <CardDescription className="text-xs md:text-sm text-muted-foreground dark:text-gray-300">
          Получайте мгновенные оповещения о заказах в Telegram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Icon name="Info" size={18} />
            Инструкция:
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>Введите номер телефона и нажмите "Получить код"</li>
            <li>Скопируйте полученный код</li>
            <li>Откройте Telegram → найдите бот @FotooMixx_bot</li>
            <li>Отправьте команду: <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">/verify ВАШ_КОД</code></li>
            <li>Вернитесь сюда и нажмите "Проверить"</li>
          </ol>
        </div>

        {!isCodeSent ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="phone">Номер телефона</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+7 900 123 45 67"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleGenerateCode}
              disabled={isLoading || !phoneNumber}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <Icon name="Key" className="w-4 h-4 mr-2" />
                  Получить код
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm font-medium mb-2 text-yellow-900 dark:text-yellow-100">Ваш код верификации:</p>
              <div className="flex items-center gap-2">
                <code className="text-2xl font-bold bg-white dark:bg-gray-800 px-4 py-2 rounded border-2 border-yellow-400 text-yellow-700 dark:text-yellow-300">
                  {code}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`/verify ${code}`);
                  }}
                  title="Скопировать команду для бота"
                >
                  <Icon name="Copy" size={16} />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCheckVerification}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <Icon name="CheckCircle" className="w-4 h-4 mr-2" />
                    Проверить
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  window.open('https://t.me/FotooMixx_bot', '_blank');
                }}
                variant="outline"
              >
                <Icon name="ExternalLink" className="w-4 h-4 mr-2" />
                Открыть бота
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
            <Icon name="AlertCircle" size={18} />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TelegramVerificationCard;