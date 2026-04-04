import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';

export const AI_TOOLS = [
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

interface AIToolsPanelProps {
  aiToolsExpanded: boolean;
  setAiToolsExpanded: (v: boolean) => void;
  selectedPlugins: Set<string>;
  togglePlugin: (key: string) => void;
  showMaskEditor: boolean;
  previewSrc: string;
  brushSize: number;
  setBrushSize: (v: number) => void;
  runningPlugins: boolean;
  pluginProgress: string;
  currentPreviewPhotoId?: number;
  onRunPlugins: () => void;
  maskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  maskDrawing: React.MutableRefObject<boolean>;
}

const AIToolsPanel = ({
  aiToolsExpanded,
  setAiToolsExpanded,
  selectedPlugins,
  togglePlugin,
  showMaskEditor,
  previewSrc,
  brushSize,
  setBrushSize,
  runningPlugins,
  pluginProgress,
  currentPreviewPhotoId,
  onRunPlugins,
  maskCanvasRef,
  maskDrawing,
}: AIToolsPanelProps) => {
  const initMaskCanvas = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [maskCanvasRef]);

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

  return (
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
                <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${iconColorMap[tool.color] || ''}`}>
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
                onClick={onRunPlugins}
                disabled={runningPlugins || !currentPreviewPhotoId}
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

          {!currentPreviewPhotoId && selectedPlugins.size > 0 && (
            <div className="text-[9px] text-amber-600 dark:text-amber-400 text-center py-0.5">
              Сначала выберите фото для обработки
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIToolsPanel;
