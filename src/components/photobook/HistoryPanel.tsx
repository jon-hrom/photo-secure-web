import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  historySize: number;
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const HistoryPanel = ({
  open,
  onClose,
  historySize,
  currentIndex,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: HistoryPanelProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>История изменений</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Всего изменений</p>
              <p className="text-2xl font-bold">{historySize}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Текущая позиция</p>
              <p className="text-2xl font-bold">{currentIndex + 1}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onUndo}
              disabled={!canUndo}
              className="flex-1"
              variant="outline"
            >
              <Icon name="Undo" size={18} className="mr-2" />
              Отменить
              {canUndo && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (Ctrl+Z)
                </span>
              )}
            </Button>
            <Button
              onClick={onRedo}
              disabled={!canRedo}
              className="flex-1"
              variant="outline"
            >
              <Icon name="Redo" size={18} className="mr-2" />
              Повторить
              {canRedo && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (Ctrl+Shift+Z)
                </span>
              )}
            </Button>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              💡 Горячие клавиши:
            </p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                  Ctrl+Z
                </kbd>
                <span>Отменить последнее действие</span>
              </li>
              <li className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                  Ctrl+Shift+Z
                </kbd>
                <span>Повторить отмененное действие</span>
              </li>
              <li className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                  Ctrl+Y
                </kbd>
                <span>Повторить (альтернативный способ)</span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <Icon name="Info" size={16} className="inline mr-1" />
              История сохраняет до 100 последних действий
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HistoryPanel;
