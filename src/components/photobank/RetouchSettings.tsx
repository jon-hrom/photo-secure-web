import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import funcUrls from '@/../backend/func2url.json';

const PRESETS_API = funcUrls['retouch-presets'];

interface PipelineOp {
  op: string;
  [key: string]: string | number | boolean;
}

interface OpConfig {
  op: string;
  label: string;
  enabled: boolean;
  params: ParamConfig[];
}

interface ParamConfig {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

const DEFAULT_OPS: OpConfig[] = [
  {
    op: 'deshine',
    label: 'Убрать блеск',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0.55, min: 0, max: 1, step: 0.05 },
      { key: 'knee', label: 'Порог', value: 0.80, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    op: 'skin_smooth',
    label: 'Гладкость кожи',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0.40, min: 0, max: 1, step: 0.05 },
      { key: 'sigma_s', label: 'Радиус', value: 80, min: 10, max: 200, step: 5 },
      { key: 'sigma_r', label: 'Детали', value: 0.18, min: 0.05, max: 0.5, step: 0.01 },
    ],
  },
];

const opsFromPipeline = (pipeline: PipelineOp[]): OpConfig[] => {
  return DEFAULT_OPS.map(def => {
    const found = pipeline.find(p => p.op === def.op);
    if (!found) return { ...def, enabled: false };
    return {
      ...def,
      enabled: true,
      params: def.params.map(param => ({
        ...param,
        value: typeof found[param.key] === 'number' ? found[param.key] as number : param.value,
      })),
    };
  });
};

const opsToJson = (ops: OpConfig[]): PipelineOp[] => {
  return ops
    .filter(o => o.enabled)
    .map(o => {
      const result: PipelineOp = { op: o.op };
      o.params.forEach(p => { result[p.key] = p.value; });
      return result;
    });
};

interface RetouchSettingsProps {
  userId: string;
  onBack: () => void;
}

const RetouchSettings = ({ userId, onBack }: RetouchSettingsProps) => {
  const [ops, setOps] = useState<OpConfig[]>(DEFAULT_OPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPreset();
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
        setOps(opsFromPipeline(pipeline));
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
      const pipeline = opsToJson(ops);
      const res = await fetch(PRESETS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ name: 'default', pipeline_json: pipeline, is_default: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Ошибка сохранения');
      }
      toast({ title: 'Настройки сохранены' });
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
    setOps(DEFAULT_OPS);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <Icon name="ArrowLeft" size={16} />
        </Button>
        <h3 className="font-medium text-sm sm:text-base">Настройки ретуши</h3>
      </div>

      <div className="space-y-4">
        {ops.map((op, opIndex) => (
          <div
            key={op.op}
            className={`rounded-xl border p-3 sm:p-4 transition-colors ${
              op.enabled
                ? 'bg-background/60 border-rose-200 dark:border-rose-800/40'
                : 'bg-muted/30 border-muted'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${!op.enabled ? 'text-muted-foreground' : ''}`}>
                {op.label}
              </span>
              <Switch checked={op.enabled} onCheckedChange={() => toggleOp(opIndex)} />
            </div>

            {op.enabled && (
              <div className="space-y-3 mt-3 pt-3 border-t border-border/50">
                {op.params.map(param => (
                  <div key={param.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">{param.label}</span>
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {param.value}
                      </span>
                    </div>
                    <Slider
                      value={[param.value]}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      onValueChange={([v]) => updateParam(opIndex, param.key, v)}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white h-10 text-sm"
        >
          {saving ? (
            <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
          ) : (
            <Icon name="Check" size={16} className="mr-2" />
          )}
          Применить
        </Button>
        <Button variant="outline" onClick={handleReset} className="h-10 text-sm">
          <Icon name="RotateCcw" size={14} className="mr-1" />
          Сброс
        </Button>
      </div>
    </div>
  );
};

export default RetouchSettings;
