import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import funcUrls from '@/../backend/func2url.json';

const PRESETS_API = funcUrls['retouch-presets'];

interface PipelineOp {
  op: string;
  [key: string]: unknown;
}

interface ParamConfig {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

interface OpConfig {
  op: string;
  label: string;
  enabled: boolean;
  params: ParamConfig[];
  extras?: Record<string, unknown>;
}

const DEFAULT_OPS: OpConfig[] = [
  {
    op: 'exposure',
    label: 'Экспозиция',
    enabled: true,
    params: [
      { key: 'amount', label: 'Сила', value: 0.55, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    op: 'shadows',
    label: 'Тени',
    enabled: true,
    params: [
      { key: 'amount', label: 'Сила', value: 0.35, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    op: 'highlights',
    label: 'Света',
    enabled: true,
    params: [
      { key: 'amount', label: 'Сила', value: 0.25, min: 0, max: 1, step: 0.05 },
      { key: 'knee', label: 'Порог', value: 0.70, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    op: 'contrast2',
    label: 'Контраст',
    enabled: true,
    params: [
      { key: 'amount', label: 'Сила', value: 0.55, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    op: 'saturation',
    label: 'Насыщенность',
    enabled: true,
    params: [
      { key: 'amount', label: 'Сила', value: 0.52, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    op: 'skin_fs',
    label: 'Гладкость кожи',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0.70, min: 0, max: 1, step: 0.05 },
      { key: 'texture_radius', label: 'Радиус текстуры', value: 6.0, min: 1, max: 20, step: 0.5 },
      { key: 'texture_amount', label: 'Текстура', value: 0.33, min: 0, max: 1, step: 0.01 },
    ],
    extras: { mask: { max_det_side: 2500 } },
  },
  {
    op: 'deshine',
    label: 'Убрать блеск',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0.65, min: 0, max: 1, step: 0.05 },
      { key: 'knee', label: 'Порог', value: 0.68, min: 0, max: 1, step: 0.05 },
    ],
    extras: { mask: { max_det_side: 2500 } },
  },
];

const opsFromPipeline = (pipeline: PipelineOp[]): OpConfig[] => {
  return DEFAULT_OPS.map(def => {
    const found = pipeline.find(p => p.op === def.op);
    if (!found) return { ...def, enabled: false };
    const extras: Record<string, unknown> = {};
    Object.keys(found).forEach(k => {
      if (k === 'op') return;
      if (def.params.some(p => p.key === k)) return;
      extras[k] = found[k];
    });
    return {
      ...def,
      enabled: true,
      params: def.params.map(param => ({
        ...param,
        value: typeof found[param.key] === 'number' ? found[param.key] as number : param.value,
      })),
      extras: Object.keys(extras).length > 0 ? extras : def.extras,
    };
  });
};

const opsToJson = (ops: OpConfig[]): PipelineOp[] => {
  return ops
    .filter(o => o.enabled)
    .map(o => {
      const result: PipelineOp = { op: o.op };
      o.params.forEach(p => { result[p.key] = p.value; });
      if (o.extras) {
        Object.entries(o.extras).forEach(([k, v]) => { result[k] = v; });
      }
      return result;
    });
};

const getParamValue = (ops: OpConfig[], opName: string, paramKey: string): number => {
  const op = ops.find(o => o.op === opName);
  if (!op || !op.enabled) return 0;
  const param = op.params.find(p => p.key === paramKey);
  return param ? param.value : 0;
};

const buildPreviewStyle = (ops: OpConfig[]): React.CSSProperties => {
  const exposure = getParamValue(ops, 'exposure', 'amount');
  const shadows = getParamValue(ops, 'shadows', 'amount');
  const highlights = getParamValue(ops, 'highlights', 'amount');
  const contrast = getParamValue(ops, 'contrast2', 'amount');
  const saturation = getParamValue(ops, 'saturation', 'amount');
  const skinStrength = getParamValue(ops, 'skin_fs', 'strength');
  const deshineStrength = getParamValue(ops, 'deshine', 'strength');

  const brightness = 0.85 + exposure * 0.35 + shadows * 0.1;
  const contrastVal = 0.85 + contrast * 0.35;
  const saturateVal = 0.8 + saturation * 0.5;
  const blurVal = skinStrength * 0.4 + deshineStrength * 0.1;
  const brightnessFromHighlights = 1 + highlights * 0.08;

  return {
    filter: `brightness(${(brightness * brightnessFromHighlights).toFixed(3)}) contrast(${contrastVal.toFixed(3)}) saturate(${saturateVal.toFixed(3)}) blur(${blurVal.toFixed(2)}px)`,
    transition: 'filter 0.15s ease',
  };
};

interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  data_url?: string;
}

interface BeforeAfterProps {
  src: string;
  previewStyle: React.CSSProperties;
}

const BeforeAfterPreview = ({ src, previewStyle }: BeforeAfterProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [containerWidth, setContainerWidth] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(2, Math.min(98, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    containerRef.current?.setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden bg-black dark:bg-black border border-border/50 select-none touch-none cursor-col-resize"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ WebkitUserSelect: 'none' }}
    >
      <img
        src={src}
        alt="After"
        className="w-full h-auto max-h-[40vh] sm:max-h-[50vh] lg:max-h-[55vh] object-contain"
        style={previewStyle}
        draggable={false}
      />

      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <img
          src={src}
          alt="Before"
          className="h-auto max-h-[40vh] sm:max-h-[50vh] lg:max-h-[55vh] object-contain block"
          style={{ width: containerWidth || '100%' }}
          draggable={false}
        />
      </div>

      <div
        className="absolute top-0 bottom-0 z-10"
        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
      >
        <div className="w-0.5 h-full bg-white/90 mx-auto" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white shadow-md flex items-center justify-center">
          <Icon name="ArrowLeftRight" size={12} className="text-gray-700" />
        </div>
      </div>

      <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm pointer-events-none">
        До
      </div>
      <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm pointer-events-none">
        После
      </div>
    </div>
  );
};

interface RetouchSettingsProps {
  userId: string;
  onBack: () => void;
  previewPhoto?: Photo | null;
}

const RetouchSettings = ({ userId, onBack, previewPhoto }: RetouchSettingsProps) => {
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

  const previewStyle = useMemo(() => buildPreviewStyle(ops), [ops]);

  const previewSrc = previewPhoto
    ? (previewPhoto.s3_url || previewPhoto.thumbnail_s3_url || previewPhoto.data_url || '')
    : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const slidersPanel = (
    <div className="space-y-1">
      {ops.map((op, opIndex) => (
        <div
          key={op.op}
          className={`rounded-lg border px-2.5 py-1.5 transition-colors ${
            op.enabled
              ? 'bg-background/60 border-rose-200 dark:border-rose-800/40'
              : 'bg-muted/30 border-muted'
          }`}
        >
          <div className="flex items-center justify-between h-6">
            <span className={`text-[11px] font-medium ${!op.enabled ? 'text-muted-foreground' : ''}`}>
              {op.label}
            </span>
            <Switch checked={op.enabled} onCheckedChange={() => toggleOp(opIndex)} className="scale-[0.8]" />
          </div>

          {op.enabled && (
            <div className="space-y-1 mt-1 pt-1 border-t border-border/40">
              {op.params.map(param => (
                <div key={param.key}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{param.label}</span>
                    <span className="text-[10px] font-mono bg-muted px-1 py-px rounded">
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
  );

  const buttonsPanel = (
    <div className="flex gap-2 pt-1">
      <Button
        onClick={handleSave}
        disabled={saving}
        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white h-8 text-xs"
      >
        {saving ? (
          <Icon name="Loader2" size={14} className="mr-1.5 animate-spin" />
        ) : (
          <Icon name="Check" size={14} className="mr-1.5" />
        )}
        Применить
      </Button>
      <Button variant="outline" onClick={handleReset} className="h-8 text-xs">
        <Icon name="RotateCcw" size={12} className="mr-1" />
        Сброс
      </Button>
    </div>
  );

  if (previewSrc) {
    return (
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={onBack}>
            <Icon name="ArrowLeft" size={16} />
          </Button>
          <h3 className="font-medium text-xs sm:text-sm">Настройки ретуши</h3>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="lg:flex-1 min-w-0">
            <BeforeAfterPreview src={previewSrc} previewStyle={previewStyle} />
          </div>

          <div className="lg:w-64 xl:w-72 flex-shrink-0">
            <div className="max-h-[35vh] sm:max-h-[45vh] lg:max-h-[55vh] overflow-y-auto pr-0.5 space-y-2 overscroll-contain">
              {slidersPanel}
              {buttonsPanel}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={onBack}>
          <Icon name="ArrowLeft" size={16} />
        </Button>
        <h3 className="font-medium text-xs sm:text-sm">Настройки ретуши</h3>
      </div>

      {slidersPanel}
      {buttonsPanel}
    </div>
  );
};

export default RetouchSettings;
