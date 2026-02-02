import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';

interface TelegramBannerProps {
  userId: number;
}

const TelegramBanner: React.FC<TelegramBannerProps> = ({ userId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const dismissed = localStorage.getItem(`telegram_banner_dismissed_${userId}`);
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    const checkVerification = async () => {
      try {
        const response = await fetch(
          `https://functions.poehali.dev/46d9b487-dbc7-4472-a333-3b30ed8d2733?action=check&user_id=${userId}`
        );
        const data = await response.json();

        if (!data.verified) {
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Error checking telegram verification:', error);
      }
    };

    checkVerification();
  }, [userId]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem(`telegram_banner_dismissed_${userId}`, 'true');
  };

  const handleNavigate = () => {
    navigate('/settings');
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="bg-blue-600 dark:bg-blue-700 text-white shadow-md relative">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Icon name="Bell" className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm md:text-base">
            <span className="font-semibold">Включите уведомления через Telegram</span>
            {' — '}
            <span className="hidden sm:inline">получайте мгновенные оповещения о заказах. </span>
            <button
              onClick={handleNavigate}
              className="underline hover:no-underline font-medium"
            >
              Привязать в Настройках →
            </button>
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TelegramBanner;
