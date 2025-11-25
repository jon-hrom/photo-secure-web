import { useState, useCallback, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
  priority: number;
}

export interface SortableColumn<T> {
  key: string;
  label: string;
  sortable: boolean;
  compareFn?: (a: T, b: T, direction: 'asc' | 'desc') => number;
}

export const useTableSort = <T extends Record<string, any>>() => {
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);

  const nextDirection = (current: SortDirection): SortDirection => {
    if (current === null) return 'asc';
    if (current === 'asc') return 'desc';
    return null;
  };

  const handleSort = useCallback((columnKey: string, isMultiSort: boolean = false) => {
    setSortConfigs(prev => {
      const existingIndex = prev.findIndex(s => s.key === columnKey);
      
      if (!isMultiSort) {
        if (existingIndex === -1) {
          return [{ key: columnKey, direction: 'asc', priority: 0 }];
        }
        
        const newDirection = nextDirection(prev[existingIndex].direction);
        if (newDirection === null) {
          return [];
        }
        
        return [{ key: columnKey, direction: newDirection, priority: 0 }];
      } else {
        if (existingIndex === -1) {
          const newConfigs = [...prev, { key: columnKey, direction: 'asc' as SortDirection, priority: prev.length }];
          return newConfigs.slice(0, 3);
        }
        
        const newDirection = nextDirection(prev[existingIndex].direction);
        if (newDirection === null) {
          const filtered = prev.filter(s => s.key !== columnKey);
          return filtered.map((s, i) => ({ ...s, priority: i }));
        }
        
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], direction: newDirection };
        return updated.slice(0, 3);
      }
    });
  }, []);

  const clearSort = useCallback(() => {
    setSortConfigs([]);
  }, []);

  const getSortDirection = useCallback((columnKey: string): SortDirection => {
    const config = sortConfigs.find(s => s.key === columnKey);
    return config?.direction || null;
  }, [sortConfigs]);

  const getSortPriority = useCallback((columnKey: string): number | null => {
    const config = sortConfigs.find(s => s.key === columnKey);
    return config ? config.priority : null;
  }, [sortConfigs]);

  const sortData = useCallback((data: T[], columns: SortableColumn<T>[]): T[] => {
    if (sortConfigs.length === 0) {
      return data;
    }

    return [...data].sort((a, b) => {
      for (const config of sortConfigs.sort((x, y) => x.priority - y.priority)) {
        if (config.direction === null) continue;

        const column = columns.find(c => c.key === config.key);
        if (!column || !column.sortable) continue;

        let comparison = 0;
        
        if (column.compareFn) {
          comparison = column.compareFn(a, b, config.direction);
        } else {
          const aVal = a[config.key];
          const bVal = b[config.key];

          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;

          if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal, 'ru', { sensitivity: 'base' });
          } else if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
          } else if (aVal instanceof Date && bVal instanceof Date) {
            comparison = aVal.getTime() - bVal.getTime();
          } else {
            comparison = String(aVal).localeCompare(String(bVal), 'ru');
          }
        }

        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }

      if ('id' in a && 'id' in b) {
        return (a.id as number) - (b.id as number);
      }
      
      return 0;
    });
  }, [sortConfigs]);

  return {
    sortConfigs,
    setSortConfigs,
    handleSort,
    clearSort,
    getSortDirection,
    getSortPriority,
    sortData,
    hasSorting: sortConfigs.length > 0,
  };
};