import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface LocationWarningBannerProps {
  userId: string | null;
  onNavigateToSettings?: () => void;
}

const LocationWarningBanner = ({ userId, onNavigateToSettings }: LocationWarningBannerProps) => {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkLocation = async () => {
      if (!userId || dismissed) return;

      try {
        const response = await fetch('https://functions.poehali.dev/8ce3cb93-2701-441d-aa3b-e9c0e99a9994', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          }
        });

        const data = await response.json();

        if (!data.success || !data.settings || !data.settings.city || !data.settings.region) {
          setShowBanner(true);
        } else {
          setShowBanner(false);
        }
      } catch (error) {
        console.error('Failed to check location:', error);
      }
    };

    checkLocation();
  }, [userId, dismissed]);

  if (!showBanner || dismissed) return null;

  const handleNavigate = () => {
    setDismissed(true);
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  return (
    <Alert className="mb-6 bg-orange-50 border-orange-200">
      <Icon name="MapPin" className="h-5 w-5 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <p className="font-semibold text-orange-900 mb-1">
            Укажите ваш город в настройках
          </p>
          <p className="text-sm text-orange-700">
            Это необходимо для правильной работы системы клиентов. Укажите область и город, где вы работаете.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="text-orange-700 hover:text-orange-900 hover:bg-orange-100"
          >
            Позже
          </Button>
          <Button
            size="sm"
            onClick={handleNavigate}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            Перейти в настройки
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default LocationWarningBanner;