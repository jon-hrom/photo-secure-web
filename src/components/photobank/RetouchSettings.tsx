import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import {
  OpConfig, Photo, DEFAULT_OPS,
  isSymmetricParam, opsFromPipeline, opsToJson,
  buildPreviewFilter, getPhotoPreviewUrl,
} from './retouchTypes';
import BeforeAfterPreview from './BeforeAfterPreview';
import PhotoPickerModal from './PhotoPickerModal';

const PRESETS_API = 'https://functions.poehali.dev/885fca99-51b3-4dd5-97da-cde77d340794';
const RETOUCH_API = 'https://functions.poehali.dev/c95989eb-d7f0-4fac-b9c9-f8ab0fb61aff';

interface RetouchSettingsProps {
  userId: string;
  onBack: () => void;
  previewPhoto?: Photo | null;
  photos?: Photo[];
}

const AI_TOOLS = [
  {
    key: 'gfpgan',
    label: 'Улучшение лиц',
    description: 'GFPGAN — убрать блеск, тени, сгладить кожу',
    icon: 'Smile' as const,
    color: 'violet',
  },
  {
    key: 'remove_bg',
    label: 'Удаление фона',
    description: 'RMBG — автоматическое удаление фона',
    icon: 'Scissors' as const,
    color: 'blue',
  },
  {
    key: 'upscale',
    label: 'Увеличение разрешения',
    description: 'RealESRGAN — апскейл с сохранением качества',
    icon: 'Maximize2' as const,
    color: 'emerald',
  },
  {
    key: 'inpaint',
    label: 'Точечная ретушь (LaMa)',
    description: 'Удаление дефектов кистью — прыщи, пятна, лишние объекты',
    icon: 'Eraser' as const,
    color: 'amber',
    requiresMask: true,
  },
];

const RetouchSettings = ({ userId, onBack, previewPhoto, photos = [] }: RetouchSettingsProps) => {
  const [ops, setOps] = useState<OpConfig[]>(DEFAULT_OPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPreviewPhoto, setCurrentPreviewPhoto] = useState<Photo | null>(previewPhoto || null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [retouchedUrl, setRetouchedUrl] = useState<string | null>(null);
  const [testingRetouch, setTestingRetouch] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [savedManualOps, setSavedManualOps] = useState<OpConfig[] | null>(null);
  const [slidersExpanded, setSlidersExpanded] = useState(false);
  const [aiToolsExpanded, setAiToolsExpanded] = useState(true);
  const [selectedPlugins, setSelectedPlugins] = useState<Set<string>>(new Set());
  const [runningPlugins, setRunningPlugins] = useState(false);
  const [pluginProgress, setPluginProgress] = useState('');
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskDrawing = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    if (previewPhoto && !currentPreviewPhoto) {
      setCurrentPreviewPhoto(previewPhoto);
    }
  }, [previewPhoto]);

  useEffect(() => {
    loadPreset();
  }, []);

  useEffect(() => {
    setRetouchedUrl(null);
  }, [currentPreviewPhoto?.id]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
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

  const pollTaskStatus = useCallback((taskId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${RETOUCH_API}?task_id=${taskId}`, {
          headers: { 'X-User-Id': userId },
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'finished' && data.result_url) {
          if (pollRef.current) clearInterval(pollRef.current);
          setRetouchedUrl(data.result_url);
          setTestingRetouch(false);
        } else if (data.status === 'failed' || data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
          setTestingRetouch(false);
          toast({
            title: 'Ошибка превью',
            description: data.error_message || 'Не удалось обработать фото',
            variant: 'destructive',
          });
        }
      } catch { /* polling error */ }
    }, 2000);
  }, [userId, toast]);

  const handleTestRetouch = async () => {
    if (!currentPreviewPhoto?.id) {
      toast({ title: 'Выберите фото для превью', variant: 'destructive' });
      return;
    }

    setTestingRetouch(true);
    setRetouchedUrl(null);

    try {
      let presetToUse = 'preview';

      if (autoMode) {
        presetToUse = 'auto';
      } else {
        const pipeline = opsToJson(ops);
        const saveRes = await fetch(PRESETS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
          body: JSON.stringify({ name: 'preview', pipeline_json: pipeline, is_default: false }),
        });
        if (!saveRes.ok) throw new Error('Не удалось сохранить пресет');
      }

      const res = await fetch(RETOUCH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ photo_id: currentPreviewPhoto.id, preset: presetToUse }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Ошибка запуска ретуши');
      }

      const data = await res.json();
      if (data.task_id) {
        pollTaskStatus(data.task_id);
      }
    } catch (e: unknown) {
      setTestingRetouch(false);
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось запустить превью',
        variant: 'destructive',
      });
    }
  };

  const togglePlugin = (key: string) => {
    const tool = AI_TOOLS.find(t => t.key === key);
    setSelectedPlugins(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (key === 'inpaint') setShowMaskEditor(false);
      } else {
        next.add(key);
        if ((tool as { requiresMask?: boolean })?.requiresMask) setShowMaskEditor(true);
      }
      return next;
    });
  };

  const initMaskCanvas = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getMaskBase64 = (): string | null => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1] || null;
  };

  const handleMaskDraw = (e: React.MouseEvent<HTMLCanvasElement>, isStart = false) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    if (isStart) maskDrawing.current = true;
    if (!maskDrawing.current) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2);
    ctx.fill();
  };

  const clearMask = () => {
    initMaskCanvas();
  };

  const handleRunPlugins = async () => {
    if (!currentPreviewPhoto?.id) {
      toast({ title: 'Сначала выберите фото', variant: 'destructive' });
      return;
    }
    if (selectedPlugins.size === 0) {
      toast({ title: 'Выберите хотя бы один инструмент', variant: 'destructive' });
      return;
    }

    const pluginOrder = AI_TOOLS.filter(t => selectedPlugins.has(t.key)).map(t => t.key);

    let maskB64: string | null = null;
    if (pluginOrder.includes('inpaint')) {
      maskB64 = getMaskBase64();
      if (!maskB64) {
        toast({ title: 'Нарисуйте маску для точечной ретуши', variant: 'destructive' });
        return;
      }
    }

    setRunningPlugins(true);
    setRetouchedUrl(null);
    const labels = pluginOrder.map(k => AI_TOOLS.find(t => t.key === k)?.label).join(' → ');
    setPluginProgress(`Обработка: ${labels}...`);

    try {
      const reqBody: Record<string, unknown> = {
        action: 'plugin',
        plugins: pluginOrder,
        photo_id: currentPreviewPhoto.id,
      };
      if (maskB64) reqBody.mask = maskB64;

      const res = await fetch(RETOUCH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Ошибка обработки');
      }

      const data = await res.json();
      if (data.result_url) {
        setRetouchedUrl(data.result_url);
        const applied = data.plugins_applied || pluginOrder;
        const appliedLabels = applied.map((k: string) => AI_TOOLS.find(t => t.key === k)?.label).filter(Boolean).join(', ');
        toast({ title: `Готово: ${appliedLabels}` });
      }

      if (data.steps) {
        const failed = data.steps.filter((s: { success: boolean }) => !s.success);
        if (failed.length > 0) {
          const failedNames = failed.map((s: { plugin: string }) => AI_TOOLS.find(t => t.key === s.plugin)?.label).join(', ');
          toast({
            title: 'Некоторые инструменты не сработали',
            description: failedNames,
            variant: 'destructive',
          });
        }
      }
    } catch (e: unknown) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось выполнить',
        variant: 'destructive',
      });
    } finally {
      setRunningPlugins(false);
      setPluginProgress('');
    }
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

  const aiToolsPanel = (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/50 overflow-hidden">
      <button
        onClick={() => setAiToolsExpanded(!aiToolsExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-950/60 dark:hover:to-purple-950/60 transition-colors"
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white">
          <Icon name="Cpu" size={13} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
            AI-инструменты
          </div>
          <div className="text-[9px] text-muted-foreground leading-tight">
            {selectedPlugins.size > 0
              ? `Выбрано: ${selectedPlugins.size} из ${AI_TOOLS.length}`
              : 'Нейросетевая обработка фото'}
          </div>
        </div>
        <Icon
          name="ChevronDown"
          size={14}
          className={`text-muted-foreground transition-transform ${aiToolsExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {aiToolsExpanded && (
        <div className="p-2 space-y-1.5 bg-background/40">
          {AI_TOOLS.map(tool => {
            const isSelected = selectedPlugins.has(tool.key);
            const iconColorMap: Record<string, string> = {
              violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
              blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
              emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
              amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
            };

            return (
              <label
                key={tool.key}
                className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                    : 'border-border/60 hover:border-border hover:bg-muted/20'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => togglePlugin(tool.key)}
                  className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <div className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ${iconColorMap[tool.color] || ''}`}>
                  <Icon name={tool.icon} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium">{tool.label}</div>
                  <div className="text-[9px] text-muted-foreground leading-tight">{tool.description}</div>
                </div>
              </label>
            );
          })}

          {showMaskEditor && selectedPlugins.has('inpaint') && previewSrc && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 p-2 space-y-1.5 bg-amber-50/30 dark:bg-amber-950/10">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <Icon name="PaintBucket" size={12} />
                  Рисуйте кистью по дефектам
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearMask}
                    className="h-5 px-1.5 text-[9px]"
                  >
                    <Icon name="Undo2" size={10} className="mr-0.5" />
                    Очистить
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] text-muted-foreground">Кисть:</span>
                <Slider
                  value={[brushSize]}
                  min={5}
                  max={50}
                  step={1}
                  onValueChange={([v]) => setBrushSize(v)}
                  className="flex-1"
                />
                <span className="text-[9px] font-mono text-muted-foreground w-6 text-right">{brushSize}</span>
              </div>
              <div className="relative rounded overflow-hidden border border-border/60">
                <img
                  src={previewSrc}
                  alt="Preview"
                  className="w-full block"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const canvas = maskCanvasRef.current;
                    if (canvas) {
                      canvas.width = img.naturalWidth;
                      canvas.height = img.naturalHeight;
                      initMaskCanvas();
                    }
                  }}
                />
                <canvas
                  ref={maskCanvasRef}
                  className="absolute inset-0 w-full h-full opacity-40 cursor-crosshair"
                  onMouseDown={(e) => handleMaskDraw(e, true)}
                  onMouseMove={handleMaskDraw}
                  onMouseUp={() => { maskDrawing.current = false; }}
                  onMouseLeave={() => { maskDrawing.current = false; }}
                />
              </div>
              <div className="text-[8px] text-muted-foreground text-center">
                Белые области будут зачищены и заполнены AI
              </div>
            </div>
          )}

          {selectedPlugins.size > 0 && (
            <div className="pt-1">
              {selectedPlugins.size > 1 && (
                <div className="text-[9px] text-indigo-600 dark:text-indigo-400 mb-1.5 flex items-center gap-1">
                  <Icon name="ArrowRight" size={10} />
                  Цепочка: {AI_TOOLS.filter(t => selectedPlugins.has(t.key)).map(t => t.label).join(' → ')}
                </div>
              )}
              <Button
                onClick={handleRunPlugins}
                disabled={runningPlugins || !currentPreviewPhoto?.id}
                className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {runningPlugins ? (
                  <>
                    <Icon name="Loader2" size={14} className="mr-1.5 animate-spin" />
                    {pluginProgress || 'Обработка...'}
                  </>
                ) : (
                  <>
                    <Icon name="Zap" size={14} className="mr-1.5" />
                    Запустить AI ({selectedPlugins.size})
                  </>
                )}
              </Button>
            </div>
          )}

          {!currentPreviewPhoto?.id && selectedPlugins.size > 0 && (
            <div className="text-[9px] text-amber-600 dark:text-amber-400 text-center py-0.5">
              Сначала выберите фото для обработки
            </div>
          )}
        </div>
      )}
    </div>
  );

  const slidersPanel = (
    <div className="space-y-1">
      <button
        onClick={() => toggleAutoMode(!autoMode)}
        className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 transition-all text-left ${
          autoMode
            ? 'bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border-violet-300 dark:border-violet-700 shadow-sm'
            : 'bg-muted/30 border-muted hover:border-muted-foreground/30'
        }`}
      >
        <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
          autoMode ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground'
        }`}>
          <Icon name="Wand2" size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-medium ${autoMode ? 'text-violet-700 dark:text-violet-300' : 'text-muted-foreground'}`}>
            Автоматическая ретушь
          </div>
          <div className="text-[9px] text-muted-foreground leading-tight">
            Сервер сам подберёт настройки
          </div>
        </div>
        <Switch checked={autoMode} onCheckedChange={toggleAutoMode} className="scale-[0.8]" />
      </button>

      {!autoMode && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 overflow-hidden">
          <button
            onClick={() => setSlidersExpanded(!slidersExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 hover:from-rose-100 hover:to-pink-100 dark:hover:from-rose-950/50 dark:hover:to-pink-950/50 transition-colors"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-500 text-white">
              <Icon name="SlidersHorizontal" size={13} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                Ручные настройки
              </div>
              <div className="text-[9px] text-muted-foreground leading-tight">
                {ops.filter(o => o.enabled).length} из {ops.length} операций включено
              </div>
            </div>
            <Icon
              name="ChevronDown"
              size={14}
              className={`text-muted-foreground transition-transform ${slidersExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {slidersExpanded && (
            <div className="p-2 space-y-1 bg-background/40">
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/40">
                <div className="flex items-center gap-1.5">
                  <Icon name={reorderMode ? "Unlock" : "Lock"} size={12} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Порядок</span>
                </div>
                <Switch checked={reorderMode} onCheckedChange={setReorderMode} className="scale-[0.7]" />
              </div>
              {ops.map((op, opIndex) => (
                <div
                  key={op.op}
                  className={`rounded-lg border px-2.5 py-1.5 transition-colors ${
                    reorderMode
                      ? 'border-dashed cursor-grab bg-muted/20 border-muted-foreground/30'
                      : op.enabled
                        ? 'bg-background/60 border-rose-200 dark:border-rose-800/40'
                        : 'bg-muted/30 border-muted'
                  }`}
                >
                  <div className="flex items-center justify-between h-6">
                    <div className="flex items-center">
                      {reorderMode && (
                        <div className="flex flex-col gap-0.5 mr-1.5">
                          <button
                            onClick={() => moveOp(opIndex, 'up')}
                            disabled={opIndex === 0}
                            className="h-3.5 w-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                          >
                            <Icon name="ChevronUp" size={10} />
                          </button>
                          <button
                            onClick={() => moveOp(opIndex, 'down')}
                            disabled={opIndex === ops.length - 1}
                            className="h-3.5 w-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                          >
                            <Icon name="ChevronDown" size={10} />
                          </button>
                        </div>
                      )}
                      <span className={`text-[11px] font-medium ${!op.enabled ? 'text-muted-foreground' : ''}`}>
                        {op.label}
                      </span>
                    </div>
                    {!reorderMode && (
                      <Switch checked={op.enabled} onCheckedChange={() => toggleOp(opIndex)} className="scale-[0.8]" />
                    )}
                  </div>

                  {op.enabled && (
                    <div className={`space-y-1 mt-1 pt-1 border-t border-border/40 ${reorderMode ? 'opacity-60 pointer-events-none' : ''}`}>
                      {op.params.map(param => (
                        <div key={param.key}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{param.label}</span>
                            <span className={`text-[10px] font-mono px-1 py-px rounded ${
                              param.value === 0 ? 'bg-muted text-muted-foreground' : param.value > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                            }`}>
                              {isSymmetricParam(param) ? (param.value > 0 ? '+' : '') : ''}{Math.round(param.value * 100) / 100}
                            </span>
                          </div>
                          <Slider
                            value={[param.value]}
                            min={param.min}
                            max={param.max}
                            step={param.step}
                            onValueChange={([v]) => updateParam(opIndex, param.key, v)}
                            onDoubleClick={() => updateParam(opIndex, param.key, isSymmetricParam(param) ? 0 : (param.min + param.max) / 2)}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const buttonsPanel = (
    <div className="space-y-1.5 pt-1">
      {previewSrc && (
        <Button
          onClick={handleTestRetouch}
          disabled={testingRetouch || !currentPreviewPhoto?.id}
          variant="outline"
          className="w-full h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
        >
          {testingRetouch ? (
            <Icon name="Loader2" size={14} className="mr-1.5 animate-spin" />
          ) : (
            <Icon name="Sparkles" size={14} className="mr-1.5" />
          )}
          {testingRetouch ? 'Обработка...' : autoMode ? 'Тест авто-ретуши' : 'Тест на фото'}
        </Button>
      )}
      <div className="flex gap-2">
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
          {autoMode ? 'Сохранить авто' : 'Применить'}
        </Button>
        <Button variant="outline" onClick={handleReset} className="h-8 text-xs">
          <Icon name="RotateCcw" size={12} className="mr-1" />
          Сброс
        </Button>
      </div>
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
            <BeforeAfterPreview
              src={previewSrc}
              filterStr={filterStr}
              retouchedSrc={retouchedUrl || undefined}
            />
          </div>

          <div className="lg:w-64 xl:w-72 flex-shrink-0">
            <div className="max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] overflow-y-auto pr-0.5 space-y-2 overscroll-contain">
              {aiToolsPanel}
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