import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';
import { OpConfig, isSymmetricParam } from './retouchTypes';

interface ManualSlidersPanelProps {
  autoMode: boolean;
  toggleAutoMode: (enabled: boolean) => void;
  ops: OpConfig[];
  toggleOp: (index: number) => void;
  updateParam: (opIndex: number, paramKey: string, value: number) => void;
  moveOp: (fromIndex: number, direction: 'up' | 'down') => void;
  reorderMode: boolean;
  setReorderMode: (v: boolean) => void;
  slidersExpanded: boolean;
  setSlidersExpanded: (v: boolean) => void;
}

const ManualSlidersPanel = ({
  autoMode,
  toggleAutoMode,
  ops,
  toggleOp,
  updateParam,
  moveOp,
  reorderMode,
  setReorderMode,
  slidersExpanded,
  setSlidersExpanded,
}: ManualSlidersPanelProps) => {
  return (
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
};

export default ManualSlidersPanel;
