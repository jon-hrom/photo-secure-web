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
      <div className="flex flex-wrap items-start gap-2">
        <Button onClick={onDetectAI} disabled={loading} variant="default" size="sm" className="gap-1.5">
          <Icon name="Sparkles" size={16} />
          Найти лого
        </Button>
        <div className="flex flex-col items-center gap-0.5">
          <Button onClick={onInpaint} disabled={loading || !hasMask} variant="default" size="sm" className="gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90">
            <Icon name="Eraser" size={16} />
            Стереть
          </Button>
          {hasMask && estimate && (
            <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-500 inline-flex items-center gap-0.5 leading-none">
              {estimate.price}
              <Icon name="Zap" size={10} className="fill-current" />
            </span>
          )}
          {hasMask && estimating && !estimate && (
            <Icon name="Loader2" size={10} className="animate-spin text-muted-foreground" />
          )}
        </div>
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

      <p className="text-[11px] text-muted-foreground px-1">
        Закрасьте лого кистью или нажмите «Найти лого». ПКМ или Ctrl — ластик маски. Два пальца или Ctrl+колесо — масштаб.
      </p>
    </>
  );
};

export default EditorToolbar;