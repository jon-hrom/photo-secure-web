import { useState, useCallback, useEffect } from 'react';
import { SortConfig } from './useTableSort';

export interface ViewPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  isDefault: boolean;
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'inactive';
  sortConfigs: SortConfig[];
  customFilters?: {
    minProjects?: number;
    minBookings?: number;
    hasEmail?: boolean;
    hasPhone?: boolean;
    createdAfter?: Date;
    createdBefore?: Date;
  };
}

const DEFAULT_PRESETS: ViewPreset[] = [
  {
    id: 'default',
    name: 'Все клиенты',
    icon: 'Users',
    description: 'Полный список без фильтров',
    isDefault: true,
    searchQuery: '',
    statusFilter: 'all',
    sortConfigs: [],
  },
  {
    id: 'active-projects',
    name: 'Активные проекты',
    icon: 'Briefcase',
    description: 'Клиенты с активными проектами',
    isDefault: true,
    searchQuery: '',
    statusFilter: 'active',
    sortConfigs: [
      { key: 'activeProjects', direction: 'desc', priority: 0 },
      { key: 'name', direction: 'asc', priority: 1 },
    ],
    customFilters: {
      minProjects: 1,
    },
  },
  {
    id: 'upcoming-meetings',
    name: 'Ближайшие встречи',
    icon: 'Calendar',
    description: 'Клиенты с запланированными встречами',
    isDefault: true,
    searchQuery: '',
    statusFilter: 'all',
    sortConfigs: [
      { key: 'activeBookings', direction: 'desc', priority: 0 },
    ],
    customFilters: {
      minBookings: 1,
    },
  },
  {
    id: 'new-clients',
    name: 'Новые клиенты',
    icon: 'UserPlus',
    description: 'Добавлены за последние 7 дней',
    isDefault: true,
    searchQuery: '',
    statusFilter: 'all',
    sortConfigs: [
      { key: 'name', direction: 'asc', priority: 0 },
    ],
    customFilters: {
      createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  },
  {
    id: 'alphabetical',
    name: 'По алфавиту',
    icon: 'SortAsc',
    description: 'Сортировка по имени А-Я',
    isDefault: true,
    searchQuery: '',
    statusFilter: 'all',
    sortConfigs: [
      { key: 'name', direction: 'asc', priority: 0 },
    ],
  },
  {
    id: 'most-projects',
    name: 'Больше всего проектов',
    icon: 'TrendingUp',
    description: 'Топ клиентов по количеству проектов',
    isDefault: true,
    searchQuery: '',
    statusFilter: 'all',
    sortConfigs: [
      { key: 'activeProjects', direction: 'desc', priority: 0 },
      { key: 'activeBookings', direction: 'desc', priority: 1 },
    ],
  },
];

const STORAGE_KEY = 'clientsViewPresets';

export const useViewPresets = () => {
  const [customPresets, setCustomPresets] = useState<ViewPreset[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
  }, [customPresets]);

  const allPresets = [...DEFAULT_PRESETS, ...customPresets];

  const savePreset = useCallback((preset: Omit<ViewPreset, 'id' | 'isDefault'>) => {
    const newPreset: ViewPreset = {
      ...preset,
      id: `custom-${Date.now()}`,
      isDefault: false,
    };
    setCustomPresets(prev => [...prev, newPreset]);
    return newPreset;
  }, []);

  const updatePreset = useCallback((id: string, updates: Partial<ViewPreset>) => {
    setCustomPresets(prev =>
      prev.map(preset =>
        preset.id === id ? { ...preset, ...updates } : preset
      )
    );
  }, []);

  const deletePreset = useCallback((id: string) => {
    setCustomPresets(prev => prev.filter(preset => preset.id !== id));
    if (activePresetId === id) {
      setActivePresetId(null);
    }
  }, [activePresetId]);

  const applyPreset = useCallback((presetId: string) => {
    const preset = allPresets.find(p => p.id === presetId);
    if (preset) {
      setActivePresetId(presetId);
      return preset;
    }
    return null;
  }, [allPresets]);

  const getPreset = useCallback((presetId: string) => {
    return allPresets.find(p => p.id === presetId);
  }, [allPresets]);

  const clearActivePreset = useCallback(() => {
    setActivePresetId(null);
  }, []);

  return {
    allPresets,
    defaultPresets: DEFAULT_PRESETS,
    customPresets,
    activePresetId,
    activePreset: activePresetId ? getPreset(activePresetId) : null,
    savePreset,
    updatePreset,
    deletePreset,
    applyPreset,
    getPreset,
    clearActivePreset,
  };
};
