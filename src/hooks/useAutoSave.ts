import { useEffect, useRef, useState, useCallback } from 'react';

interface AutoSaveOptions {
  key: string;
  delay?: number;
  enabled?: boolean;
}

interface AutoSaveReturn {
  loadSaved: () => any | null;
  clearSaved: () => void;
  lastSaved: Date | null;
  isSaving: boolean;
}

export function useAutoSave<T>(
  data: T,
  { key, delay = 2000, enabled = true }: AutoSaveOptions
): AutoSaveReturn {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isFirstRender = useRef(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsSaving(true);

    timeoutRef.current = setTimeout(() => {
      try {
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
        setLastSaved(new Date());
        setIsSaving(false);
      } catch (error) {
        console.error('Ошибка автосохранения:', error);
        setIsSaving(false);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, key, delay, enabled]);

  const loadSaved = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved) as T;
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    }
    return null;
  }, [key]);

  const clearSaved = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setLastSaved(null);
    } catch (error) {
      console.error('Ошибка очистки:', error);
    }
  }, [key]);

  return { loadSaved, clearSaved, lastSaved, isSaving };
}