import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import {
  OpConfig, Photo, DEFAULT_OPS,
  opsFromPipeline, opsToJson,
  buildPreviewFilter, getPhotoPreviewUrl,
} from './retouchTypes';
import BeforeAfterPreview from './BeforeAfterPreview';
import PhotoPickerModal from './PhotoPickerModal';
import AIToolsPanel, { AI_TOOLS } from './AIToolsPanel';
import ManualSlidersPanel from './ManualSlidersPanel';
import RetouchActionButtons from './RetouchActionButtons';

const PRESETS_API = 'https://functions.poehali.dev/885fca99-51b3-4dd5-97da-cde77d340794';
const RETOUCH_API = 'https://functions.poehali.dev/c95989eb-d7f0-4fac-b9c9-f8ab0fb61aff';

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
          console.log('[RETOUCH] result_url:', data.result_url);
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

  const getMaskBase64 = (): string | null => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1] || null;
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
              <AIToolsPanel
                aiToolsExpanded={aiToolsExpanded}
                setAiToolsExpanded={setAiToolsExpanded}
                selectedPlugins={selectedPlugins}
                togglePlugin={togglePlugin}
                showMaskEditor={showMaskEditor}
                previewSrc={previewSrc}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                runningPlugins={runningPlugins}
                pluginProgress={pluginProgress}
                currentPreviewPhotoId={currentPreviewPhoto?.id}
                onRunPlugins={handleRunPlugins}
                maskCanvasRef={maskCanvasRef}
                maskDrawing={maskDrawing}
              />
              <ManualSlidersPanel
                autoMode={autoMode}
                toggleAutoMode={toggleAutoMode}
                ops={ops}
                toggleOp={toggleOp}
                updateParam={updateParam}
                moveOp={moveOp}
                reorderMode={reorderMode}
                setReorderMode={setReorderMode}
                slidersExpanded={slidersExpanded}
                setSlidersExpanded={setSlidersExpanded}
              />
              <RetouchActionButtons
                previewSrc={previewSrc}
                testingRetouch={testingRetouch}
                currentPreviewPhotoId={currentPreviewPhoto?.id}
                autoMode={autoMode}
                saving={saving}
                onTestRetouch={handleTestRetouch}
                onSave={handleSave}
                onReset={handleReset}
              />
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