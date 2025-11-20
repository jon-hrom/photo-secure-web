import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export const useAdminPanelHistory = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/ceedefc9-0cb9-4dbc-87aa-4865e7011d43');
      const data = await response.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
    }
  };

  const rollbackToVersion = async (historyId: number) => {
    try {
      const response = await fetch('https://functions.poehali.dev/ceedefc9-0cb9-4dbc-87aa-4865e7011d43', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'jonhrom2012@gmail.com',
        },
        body: JSON.stringify({ historyId }),
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Откат выполнен успешно');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ошибка отката:', error);
      toast.error('Не удалось выполнить откат');
      return false;
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return {
    history,
    showHistory,
    setShowHistory,
    loadHistory,
    rollbackToVersion,
  };
};
