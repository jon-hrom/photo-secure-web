import { useEffect, useRef } from 'react';

interface AutoSaveOptions {
  key: string;
  delay?: number;
  enabled?: boolean;
}

export function useAutoSave<T>(
  data: T,
  { key, delay = 2000, enabled = true }: AutoSaveOptions
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!enabled) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
        const timestamp = new Date().toLocaleTimeString('ru-RU');
        console.log(`💾 Автосохранение: ${timestamp}`);
      } catch (error) {
        console.error('Ошибка автосохранения:', error);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, key, delay, enabled]);

  const loadSaved = (): T | null => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved) as T;
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    }
    return null;
  };

  const clearSaved = () => {
    try {
      localStorage.removeItem(key);
      console.log('🗑️ Автосохранение очищено');
    } catch (error) {
      console.error('Ошибка очистки:', error);
    }
  };

  return { loadSaved, clearSaved };
}
