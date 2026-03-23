import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
      { key: 'amount', label: 'Сила', value: 0.55, min: 0, max: 10, step: 0.1 },
    ],
  },
  {
    op: 'temperature',
    label: 'Температура',
    enabled: false,
    params: [
      { key: 'amount', label: 'Тепло', value: 0, min: -10, max: 10, step: 0.1 },
    ],
  },
  {
    op: 'shadows',
    label: 'Тени',
    enabled: true,
    params: [
      { key: 'amount', label: 'Сила', value: 0.35, min: 0, max: 10, step: 0.1 },
    ],
  },
  {
    op: 'highlights',
    label: 'Света',
    enabled: true,
    params: [
      { key: 'amount', label: 'Сила', value: 0.25, min: 0, max: 10, step: 0.1 },
      { key: 'knee', label: 'Порог', value: 0.70, min: 0, max: 10, step: 0.1 },
    ],
  },
  {
    op: 'contrast2',
    label: 'Контраст',
    enabled: true,
    params: [
      { key: 'amount', label: 'Сила', value: 0.55, min: 0, max: 10, step: 0.1 },
    ],
  },
  {
    op: 'saturation',
    label: 'Насыщенность',
    enabled: true,
    params: [
      { key: 'amount', label: 'Сила', value: 0.52, min: 0, max: 10, step: 0.1 },
    ],
  },
  {
    op: 'skin_fs',
    label: 'Гладкость кожи',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0.70, min: 0, max: 10, step: 0.1 },
      { key: 'texture_radius', label: 'Радиус текстуры', value: 6.0, min: 1, max: 20, step: 0.5 },
      { key: 'texture_amount', label: 'Текстура', value: 0.33, min: 0, max: 10, step: 0.1 },
    ],
    extras: { mask: { max_det_side: 2500 } },
  },
  {
    op: 'deshine',
    label: 'Убрать блеск',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0.65, min: 0, max: 10, step: 0.1 },
      { key: 'knee', label: 'Порог', value: 0.68, min: 0, max: 10, step: 0.1 },
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

const buildPreviewFilter = (ops: OpConfig[]): string => {
  const exposure = getParamValue(ops, 'exposure', 'amount');
  const temperature = getParamValue(ops, 'temperature', 'amount');
  const shadows = getParamValue(ops, 'shadows', 'amount');
  const highlights = getParamValue(ops, 'highlights', 'amount');
  const contrast = getParamValue(ops, 'contrast2', 'amount');
  const saturation = getParamValue(ops, 'saturation', 'amount');
  const skinStrength = getParamValue(ops, 'skin_fs', 'strength');
  const deshineStrength = getParamValue(ops, 'deshine', 'strength');

  const brightness = 1.0 + exposure * 0.15 + shadows * 0.08 - highlights * 0.04;
  const contrastVal = 1.0 + contrast * 0.12;
  const saturateVal = 1.0 + saturation * 0.15;
  const blurVal = skinStrength * 0.25 + deshineStrength * 0.03;

  const warmth = temperature * 3;
  const sepiaAmount = warmth > 0 ? Math.min(warmth * 0.05, 0.5) : 0;
  const hueRotate = warmth < 0 ? warmth * 1.5 : 0;

  let filter = `brightness(${brightness.toFixed(3)}) contrast(${contrastVal.toFixed(3)}) saturate(${saturateVal.toFixed(3)})`;
  if (blurVal > 0.01) filter += ` blur(${blurVal.toFixed(2)}px)`;
  if (sepiaAmount > 0.001) filter += ` sepia(${sepiaAmount.toFixed(3)})`;
  if (hueRotate !== 0) filter += ` hue-rotate(${hueRotate.toFixed(1)}deg)`;

  return filter;
};

interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  data_url?: string;
}

const isRawFile = (name: string): boolean => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'raf', 'rw2', 'pef', 'srw'].includes(ext);
};

const getPhotoUrl = (photo: Photo): string => {
  if (photo.thumbnail_s3_url) return photo.thumbnail_s3_url;
  if (photo.data_url) return photo.data_url;
  if (photo.s3_url && !isRawFile(photo.file_name)) return photo.s3_url;
  return '';
};

const getPhotoPreviewUrl = (photo: Photo): string => {
  if (photo.thumbnail_s3_url) return photo.thumbnail_s3_url;
  if (photo.s3_url && !isRawFile(photo.file_name)) return photo.s3_url;
  if (photo.data_url) return photo.data_url;
  return '';
};

interface BeforeAfterProps {
  src: string;
  filterStr: string;
}

const BeforeAfterPreview = ({ src, filterStr }: BeforeAfterProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const dragging = useRef(false);

  useEffect(() => {
    setImgState('loading');
  }, [src]);

  const imgLoaded = imgState === 'loaded';

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
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

  if (!src) {
    return (
      <div className="rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center h-48 sm:h-64">
        <div className="text-center text-muted-foreground">
          <Icon name="ImageOff" size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs">RAW-файл без превью</p>
          <p className="text-[10px] mt-1 opacity-70">Выберите JPG/PNG фото</p>
        </div>
      </div>
    );
  }

  const imgClass = 'w-full h-auto max-h-[40vh] sm:max-h-[50vh] lg:max-h-[55vh] object-contain';

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden bg-black border border-border/50 select-none touch-none cursor-col-resize"
      onPointerDown={imgLoaded ? onPointerDown : undefined}
      onPointerMove={imgLoaded ? onPointerMove : undefined}
      onPointerUp={imgLoaded ? onPointerUp : undefined}
      style={{ WebkitUserSelect: 'none' }}
    >
      {imgState === 'loading' && (
        <div className="flex items-center justify-center h-48 sm:h-64">
          <Icon name="Loader2" size={24} className="animate-spin text-white/50" />
        </div>
      )}

      {imgState === 'error' && (
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="text-center text-white/60">
            <Icon name="ImageOff" size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">Не удалось загрузить</p>
          </div>
        </div>
      )}

      {/* ДО — оригинал, полноразмерный, обрезается clip-path справа */}
      <img
        src={src}
        alt=""
        className={`${imgClass} ${imgLoaded ? '' : 'hidden'}`}
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        draggable={false}
        onLoad={() => setImgState('loaded')}
        onError={() => setImgState('error')}
      />

      {/* ПОСЛЕ — с фильтром, абсолютно позиционирован поверх, обрезается clip-path слева */}
      {imgLoaded && (
        <img
          src={src}
          alt=""
          className={`absolute inset-0 ${imgClass}`}
          style={{
            filter: filterStr,
            transition: 'filter 0.1s ease',
            clipPath: `inset(0 0 0 ${sliderPos}%)`,
          }}
          draggable={false}
        />
      )}

      {imgLoaded && (
        <>
          {/* Разделитель */}
          <div
            className="absolute top-0 bottom-0 z-10"
            style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-0.5 h-full bg-white/90 mx-auto" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white shadow-md flex items-center justify-center">
              <Icon name="ArrowLeftRight" size={12} className="text-gray-700" />
            </div>
          </div>

          <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm pointer-events-none z-20">
            До
          </div>
          <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm pointer-events-none z-20">
            После
          </div>
        </>
      )}
    </div>
  );
};

interface PhotoPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: Photo[];
  selectedId: number | null;
  onSelect: (photo: Photo) => void;
}

const PhotoPickerModal = ({ open, onOpenChange, photos, selectedId, onSelect }: PhotoPickerModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-1rem)] rounded-2xl sm:rounded-xl p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-sm sm:text-base">Выберите фото для предпросмотра</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Это фото будет использоваться для предварительного просмотра настроек
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[50vh] overflow-y-auto -mx-1 px-1 mt-2">
          {photos.map(photo => (
            <button
              key={photo.id}
              onClick={() => { onSelect(photo); onOpenChange(false); }}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all active:scale-95 ${
                selectedId === photo.id
                  ? 'border-rose-500 ring-2 ring-rose-300 shadow-lg'
                  : 'border-transparent hover:border-rose-200'
              }`}
            >
              <img
                src={getPhotoUrl(photo)}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {selectedId === photo.id && (
                <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                  <Icon name="Check" size={18} className="text-white drop-shadow-lg" />
                </div>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface RetouchSettingsProps {
  userId: string;
  onBack: () => void;
  previewPhoto?: Photo | null;
  photos?: Photo[];
}

const RetouchSettings = ({ userId, onBack, previewPhoto, photos = [] }: RetouchSettingsProps) => {
  const [ops, setOps] = useState<OpConfig[]>(DEFAULT_OPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPreviewPhoto, setCurrentPreviewPhoto] = useState<Photo | null>(previewPhoto || null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (previewPhoto && !currentPreviewPhoto) {
      setCurrentPreviewPhoto(previewPhoto);
    }
  }, [previewPhoto]);

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

  const filterStr = useMemo(() => buildPreviewFilter(ops), [ops]);

  const previewSrc = currentPreviewPhoto ? getPhotoPreviewUrl(currentPreviewPhoto) : '';

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

  return (
    <>
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={onBack}>
            <Icon name="ArrowLeft" size={16} />
          </Button>
          <h3 className="font-medium text-xs sm:text-sm flex-1">Настройки ретуши</h3>
          {photos.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowPhotoPicker(true)}
            >
              <Icon name="Images" size={12} className="mr-1" />
              Сменить фото
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="lg:flex-1 min-w-0">
            <BeforeAfterPreview src={previewSrc} filterStr={filterStr} />
          </div>

          <div className="lg:w-64 xl:w-72 flex-shrink-0">
            <div className="max-h-[35vh] sm:max-h-[45vh] lg:max-h-[55vh] overflow-y-auto pr-0.5 space-y-2 overscroll-contain">
              {slidersPanel}
              {buttonsPanel}
            </div>
          </div>
        </div>
      </div>

      {photos.length > 1 && (
        <PhotoPickerModal
          open={showPhotoPicker}
          onOpenChange={setShowPhotoPicker}
          photos={photos}
          selectedId={currentPreviewPhoto?.id || null}
          onSelect={setCurrentPreviewPhoto}
        />
      )}
    </>
  );
};

export default RetouchSettings;