import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Icon from '@/components/ui/icon';

interface TelegramVerificationProps {
  userId: number;
  onVerified: () => void;
}

const TelegramVerification: React.FC<TelegramVerificationProps> = ({ userId, onVerified }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);

  const verifyUrl = 'https://functions.poehali.dev/46d9b487-dbc7-4472-a333-3b30ed8d2733';

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
        onVerified();
      }
    } catch (err) {
      console.error('Error checking verification:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="MessageCircle" className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Подключите Telegram
          </h2>
          <p className="text-gray-600">
            Для получения уведомлений о съёмках необходимо привязать Telegram
          </p>
        </div>

        {!isCodeSent ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Номер телефона
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+7 900 123-45-67"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Укажите номер, привязанный к Telegram
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerateCode}
              disabled={isLoading || !phoneNumber}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Генерация кода...
                </>
              ) : (
                'Получить код'
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600 mb-2">Ваш код подтверждения:</p>
                <p className="text-4xl font-bold text-blue-600 tracking-wider">{code}</p>
              </div>

              <div className="bg-white rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-gray-900">Что делать дальше:</p>
                <ol className="text-sm text-gray-600 space-y-2">
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-600">1.</span>
                    <span>Откройте Telegram</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-600">2.</span>
                    <span>Найдите бота <strong>@FotooMixx_bot</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-600">3.</span>
                    <span>Отправьте команду:</span>
                  </li>
                </ol>
                <div className="bg-gray-100 rounded px-3 py-2 font-mono text-sm">
                  /verify {code}
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckVerification}
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <Icon name="CheckCircle2" className="w-5 h-5" />
                  Я подтвердил в боте
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsCodeSent(false);
                setCode('');
                setPhoneNumber('');
              }}
              className="w-full text-gray-600 py-2 text-sm hover:text-gray-900 transition-colors"
            >
              Изменить номер телефона
            </button>

            <div className="text-xs text-gray-500 text-center">
              <Icon name="Clock" className="w-3 h-3 inline mr-1" />
              Код действителен 10 минут
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelegramVerification;
