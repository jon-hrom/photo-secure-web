import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Estimate } from '@/components/tools/logoRemover/useCanvasState';

interface EditorToolbarProps {
  loading: boolean;
  hasMask: boolean;
  historyLen: number;
  estimate: Estimate | null;
  estimating: boolean;
  onDetectAI: () => void;
  onInpaint: () => void;
  onClearMask: () => void;
  onUndo: () => void;
  onDownload: () => void;
  onOpenSaver: () => void;
  onReset: () => void;
}

const EditorToolbar = ({
  loading,
  hasMask,
  historyLen,
  estimate,
  estimating,
  onDetectAI,
  onInpaint,
  onClearMask,
  onUndo,
  onDownload,
  onOpenSaver,
  onReset,
}: EditorToolbarProps) => {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onDetectAI} disabled={loading} variant="default" size="sm" className="gap-1.5">
          <Icon name="Sparkles" size={16} />
          Найти AI
        </Button>
        <Button onClick={onInpaint} disabled={loading || !hasMask} variant="default" size="sm" className="gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90">
          <Icon name="Eraser" size={16} />
          Стереть
        </Button>
        <Button onClick={onClearMask} disabled={loading || !hasMask} variant="outline" size="sm" className="gap-1.5">
          <Icon name="X" size={16} />
          Очистить кисть
        </Button>
        <Button onClick={onUndo} disabled={loading || historyLen < 2} variant="outline" size="sm" className="gap-1.5">
          <Icon name="Undo2" size={16} />
          Отменить
        </Button>
        <Button onClick={onDownload} disabled={loading} variant="outline" size="sm" className="gap-1.5">
          <Icon name="Download" size={16} />
          Скачать
        </Button>
        <Button onClick={onOpenSaver} disabled={loading} variant="outline" size="sm" className="gap-1.5">
          <Icon name="Save" size={16} />
          В фотобанк
        </Button>
        <Button onClick={onReset} disabled={loading} variant="ghost" size="sm" className="gap-1.5 ml-auto">
          <Icon name="RotateCcw" size={16} />
          Новое фото
        </Button>
      </div>

      {hasMask && (
        <div className="px-1 -mt-1">
          {estimating && !estimate && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Icon name="Loader2" size={12} className="animate-spin" />
              Подбираем режим...
            </span>
          )}
          {estimate && (
            <span className="text-[11px] flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="font-medium">{estimate.label}</span>
              <span className="text-muted-foreground">— {estimate.hint}.</span>
              {estimate.price > 0 ? (
                <span className="font-semibold text-yellow-600 dark:text-yellow-500 flex items-center gap-0.5">
                  Спишется {estimate.price}
                  <Icon name="Zap" size={11} className="fill-current" />
                </span>
              ) : (
                <span className="font-semibold text-emerald-600 dark:text-emerald-500">Бесплатно</span>
              )}
            </span>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground px-1">
        Закрасьте лого кистью или нажмите «Найти AI». ПКМ или Ctrl — ластик маски. Два пальца или Ctrl+колесо — масштаб.
      </p>
    </>
  );
};

export default EditorToolbar;