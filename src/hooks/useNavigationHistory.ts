import { useState, useCallback } from 'react';

interface NavigationState {
  viewMode: 'cards' | 'table';
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'inactive';
  selectedClientId?: number;
  timestamp: number;
}

export const useNavigationHistory = () => {
  const [history, setHistory] = useState<NavigationState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const pushState = useCallback((state: Omit<NavigationState, 'timestamp'>) => {
    const newState: NavigationState = {
      ...state,
      timestamp: Date.now(),
    };

    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newState);
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    
    setCurrentIndex(prev => {
      const newIndex = Math.min(prev + 1, 49);
      return newIndex;
    });
  }, [currentIndex]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [currentIndex, history]);

  const goForward = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return history[currentIndex + 1];
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
  };
};
