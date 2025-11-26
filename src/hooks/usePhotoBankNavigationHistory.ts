import { useState, useCallback, useRef } from 'react';

interface PhotoBankNavigationState {
  selectedFolderId: number | null;
  selectionMode: boolean;
  timestamp: number;
}

export const usePhotoBankNavigationHistory = () => {
  const [history, setHistory] = useState<PhotoBankNavigationState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const lastPushTime = useRef<number>(0);

  const pushState = useCallback((state: Omit<PhotoBankNavigationState, 'timestamp'>) => {
    const now = Date.now();
    
    // Дебаунс: игнорируем быстрые последовательные вызовы (< 500ms)
    if (now - lastPushTime.current < 500) {
      return;
    }
    lastPushTime.current = now;

    setHistory(prev => {
      const newState: PhotoBankNavigationState = {
        ...state,
        timestamp: now,
      };

      // Если мы не в конце истории, удаляем всё после текущей позиции
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Не добавляем дубликаты
      const lastState = newHistory[newHistory.length - 1];
      if (lastState && 
          lastState.selectedFolderId === newState.selectedFolderId &&
          lastState.selectionMode === newState.selectionMode) {
        return prev;
      }

      newHistory.push(newState);
      
      // Ограничиваем размер истории до 50 записей
      if (newHistory.length > 50) {
        newHistory.shift();
        setCurrentIndex(newHistory.length - 1);
        return newHistory;
      }
      
      setCurrentIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [currentIndex]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      return history[newIndex];
    }
    return null;
  }, [currentIndex, history]);

  const goForward = useCallback(() => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      return history[newIndex];
    }
    return null;
  }, [currentIndex, history]);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;

  return {
    pushState,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    currentState: history[currentIndex],
    historyLength: history.length,
    currentIndex,
  };
};
