import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import funcUrls from '@/../backend/func2url.json';
import {
  OpConfig, Photo, DEFAULT_OPS,
  isSymmetricParam, opsFromPipeline, opsToJson,
  buildPreviewFilter, getPhotoPreviewUrl,
} from './retouchTypes';
import BeforeAfterPreview from './BeforeAfterPreview';
import PhotoPickerModal from './PhotoPickerModal';

const PRESETS_API = funcUrls['retouch-presets'];
const RETOUCH_API = funcUrls['retouch'];

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
      } catch {
        // ignore polling errors
      }
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
      const pipeline = opsToJson(ops);

      const saveRes = await fetch(PRESETS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ name: 'preview', pipeline_json: pipeline, is_default: false }),
      });
      if (!saveRes.ok) throw new Error('Не удалось сохранить пресет');

      const res = await fetch(RETOUCH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ photo_id: currentPreviewPhoto.id, preset: 'preview' }),
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
          {testingRetouch ? 'Обработка...' : 'Тест на фото'}
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
          Применить
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