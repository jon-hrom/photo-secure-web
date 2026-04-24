import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  OpConfig, DEFAULT_OPS,
  opsFromPipeline, opsToJson,
} from '../retouchTypes';

const PRESETS_API = 'https://functions.poehali.dev/885fca99-51b3-4dd5-97da-cde77d340794';

interface UseRetouchPresetArgs {
  userId: string;
  onBack: () => void;
  selectedPlugins: Set<string>;
  setSelectedPlugins: (s: Set<string>) => void;
  setRetouchedUrl: (u: string | null) => void;
}

export function useRetouchPreset({
  userId,
  onBack,
  selectedPlugins,
  setSelectedPlugins,
  setRetouchedUrl,
}: UseRetouchPresetArgs) {
  const [ops, setOps] = useState<OpConfig[]>(DEFAULT_OPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [savedManualOps, setSavedManualOps] = useState<OpConfig[] | null>(null);
  const [slidersExpanded, setSlidersExpanded] = useState(false);
  const { toast } = useToast();

  const moveOp = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= ops.length) return;
    setOps(prev => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  };

  useEffect(() => {
    loadPreset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPreset = async () => {
    setLoading(true);
    try {
      const res = await fetch(PRESETS_API, {
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      });
      if (!res.ok) throw new Error('Не удалось загрузить');
      const data = await res.json();
      const defaultPreset = (data.presets || []).find((p: { is_default: boolean }) => p.is_default);
      if (defaultPreset?.pipeline_json) {
        const pipeline = typeof defaultPreset.pipeline_json === 'string'
          ? JSON.parse(defaultPreset.pipeline_json)
          : defaultPreset.pipeline_json;
        if (Array.isArray(pipeline) && pipeline.length === 1 && pipeline[0]?.op === 'auto') {
          setAutoMode(true);
          setOps(prev => prev.map(o => ({ ...o, enabled: false })));
          setSlidersExpanded(false);
          const savedPlugins = pipeline[0]?.ai_plugins;
          if (Array.isArray(savedPlugins) && savedPlugins.length > 0) {
            setSelectedPlugins(new Set(savedPlugins));
          }
        } else {
          setOps(opsFromPipeline(pipeline));
          setSlidersExpanded(false);
        }
      }
    } catch (e) {
      console.error('[RETOUCH SETTINGS] Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleOp = (index: number) => {
    setOps(prev => prev.map((o, i) => i === index ? { ...o, enabled: !o.enabled } : o));
  };

  const updateParam = (opIndex: number, paramKey: string, value: number) => {
    setOps(prev => prev.map((o, i) =>
      i === opIndex
        ? { ...o, params: o.params.map(p => p.key === paramKey ? { ...p, value } : p) }
        : o
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const aiPlugins = Array.from(selectedPlugins);
      const pipeline = autoMode ? [{ op: 'auto', ai_plugins: aiPlugins }] : opsToJson(ops);
      const res = await fetch(PRESETS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ name: 'default', pipeline_json: pipeline, is_default: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Ошибка сохранения');
      }
      toast({ title: autoMode ? 'Автоматическая ретушь включена' : 'Настройки сохранены' });
      onBack();
    } catch (e: unknown) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось сохранить',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setAutoMode(false);
    setSavedManualOps(null);
    setOps(DEFAULT_OPS);
    setRetouchedUrl(null);
  };

  const toggleAutoMode = (enabled: boolean) => {
    if (enabled) {
      setSavedManualOps(ops);
      setOps(prev => prev.map(o => ({ ...o, enabled: false })));
      setSlidersExpanded(false);
    } else {
      if (savedManualOps) {
        setOps(savedManualOps);
        setSavedManualOps(null);
      } else {
        setOps(DEFAULT_OPS);
      }
      setSlidersExpanded(true);
    }
    setAutoMode(enabled);
    setRetouchedUrl(null);
  };

  return {
    ops,
    setOps,
    loading,
    saving,
    autoMode,
    slidersExpanded,
    setSlidersExpanded,
    moveOp,
    toggleOp,
    updateParam,
    handleSave,
    handleReset,
    toggleAutoMode,
  };
}
