import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AI_TOOLS } from '../AIToolsPanel';

const RETOUCH_API = 'https://functions.poehali.dev/c95989eb-d7f0-4fac-b9c9-f8ab0fb61aff';

interface UseRetouchPluginsArgs {
  userId: string;
  currentPreviewPhotoId: number | string | undefined;
  setRetouchedUrl: (u: string | null) => void;
}

export function useRetouchPlugins({
  userId,
  currentPreviewPhotoId,
  setRetouchedUrl,
}: UseRetouchPluginsArgs) {
  const [selectedPlugins, setSelectedPluginsState] = useState<Set<string>>(new Set());
  const [runningPlugins, setRunningPlugins] = useState(false);
  const [pluginProgress, setPluginProgress] = useState('');
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskDrawing = useRef(false);
  const { toast } = useToast();

  const setSelectedPlugins = (s: Set<string>) => setSelectedPluginsState(s);

  const togglePlugin = (key: string) => {
    const tool = AI_TOOLS.find(t => t.key === key);
    setSelectedPluginsState(prev => {
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
    if (!currentPreviewPhotoId) {
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
        photo_id: currentPreviewPhotoId,
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

  return {
    selectedPlugins,
    setSelectedPlugins,
    runningPlugins,
    pluginProgress,
    showMaskEditor,
    brushSize,
    setBrushSize,
    maskCanvasRef,
    maskDrawing,
    togglePlugin,
    handleRunPlugins,
  };
}
