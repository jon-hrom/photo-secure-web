import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Estimate } from '@/components/tools/logoRemover/useCanvasState';

interface EditorToolbarProps {
  loading: boolean;
  hasMask: boolean;
  historyLen: number;
  estimate: Estimate | null;
  estimating: boolean;
  onAutoRemove: () => void;
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
  onAutoRemove,
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
        <div className="flex flex-col items-center gap-0.5">
          <Button onClick={onAutoRemove} disabled={loading} variant="default" size="sm" className="gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90">
            <Icon name="Sparkles" size={16} />
            Удалить лого
          </Button>
          <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-500 inline-flex items-center gap-0.5 leading-none">
            {estimating && !estimate ? (
              <Icon name="Loader2" size={10} className="animate-spin text-muted-foreground" />
            ) : (
              <>
                {estimate?.price ?? 25}
                <Icon name="Zap" size={10} className="fill-current" />
              </>
            )}
          </span>
        </div>
        {hasMask && (
          <Button onClick={onInpaint} disabled={loading} variant="outline" size="sm" className="gap-1.5">
            <Icon name="Eraser" size={16} />
            Стереть выделенное
          </Button>
        )}
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
        AI не заметил лого? Закрасьте его кистью и нажмите «Стереть выделенное». ПКМ или Ctrl — ластик маски. Два пальца или Ctrl+колесо — масштаб.
      </p>
    </>
  );
};

export default EditorToolbar;