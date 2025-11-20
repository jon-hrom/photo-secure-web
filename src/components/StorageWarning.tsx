import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import Icon from '@/components/ui/icon';

const STORAGE_API = 'https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985';

interface StorageUsage {
  usedGb: number;
  limitGb: number;
  percent: number;
  remainingGb: number;
  warning: boolean;
  plan_name?: string;
}

const StorageWarning = () => {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const userId = localStorage.getItem('userId') || '1';

  useEffect(() => {
    fetchUsage();
    const dismissedKey = 'storageWarningDismissed';
    const isDismissed = localStorage.getItem(dismissedKey);
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  const fetchUsage = async () => {
    try {
      const res = await fetch(`${STORAGE_API}?action=usage`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setUsage(data);
    } catch (error) {
      console.error('Failed to fetch storage usage:', error);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('storageWarningDismissed', 'true');
  };

  if (!usage || usage.percent < 90 || dismissed) {
    return null;
  }

  return (
    <Alert className="bg-orange-50 border-orange-500 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <Icon name="X" size={16} />
      </Button>
      <Icon name="AlertTriangle" className="h-5 w-5 text-orange-600" />
      <AlertTitle className="text-orange-800 font-semibold">
        Хранилище заканчивается
      </AlertTitle>
      <AlertDescription className="text-orange-700">
        Использовано {(usage.usedGb || 0).toFixed(2)} ГБ из {(usage.limitGb || 5).toFixed(0)} ГБ ({(usage.percent || 0).toFixed(1)}%).
        Осталось только {(usage.remainingGb || 0).toFixed(2)} ГБ свободного места.
        <div className="mt-3 text-sm">
          Обратитесь к администратору для увеличения лимита хранилища.
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default StorageWarning;