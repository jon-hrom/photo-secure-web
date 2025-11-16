import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { PhotobookConfig } from '../PhotobookCreator';

interface EditorTopToolbarProps {
  config: PhotobookConfig;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  currentIndex: number;
  historySize: number;
  onShowHistory: () => void;
  lastSaved: Date | null;
  isSaving: boolean;
}

const EditorTopToolbar = ({
  config,
  undo,
  redo,
  canUndo,
  canRedo,
  currentIndex,
  historySize,
  onShowHistory,
  lastSaved,
  isSaving,
}: EditorTopToolbarProps) => {
  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };
  return (
    <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-yellow-400 rounded flex items-center justify-center">
            <Icon name="Camera" size={24} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Фотокниги на фотобумаге</p>
            <p className="text-sm font-semibold">
              20x20 Фотокнига (1-40р) без прослойки
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            title="Отменить (Ctrl+Z)"
            className="h-8 relative"
          >
            <Icon name="Undo" size={18} />
            {canUndo && currentIndex > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {currentIndex}
              </span>
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            title="Повторить (Ctrl+Shift+Z)"
            className="h-8 relative"
          >
            <Icon name="Redo" size={18} />
            {canRedo && (historySize - currentIndex - 1) > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {historySize - currentIndex - 1}
              </span>
            )}
          </Button>
          <div className="h-6 w-px bg-gray-300 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowHistory}
            title="История изменений"
            className="h-8"
          >
            <Icon name="History" size={18} />
            {historySize > 1 && (
              <span className="ml-1 text-xs text-muted-foreground">
                {historySize}
              </span>
            )}
          </Button>
        </div>
        
        {lastSaved && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isSaving ? (
              <>
                <Icon name="Loader2" size={14} className="animate-spin" />
                <span>Сохранение...</span>
              </>
            ) : (
              <>
                <Icon name="Check" size={14} className="text-green-500" />
                <span>Сохранено {formatTime(lastSaved)}</span>
              </>
            )}
          </div>
        )}
        
        <div className="h-6 w-px bg-gray-300" />
        <Button variant="outline" size="sm">
          <Icon name="Eye" size={18} className="mr-2" />
          Предпросмотр
        </Button>
        <Button variant="outline" size="sm">
          <Icon name="Save" size={18} className="mr-2" />
          Сохранить
        </Button>
        <Button
          size="sm"
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
        >
          Заказать за {config.price.toLocaleString('ru-RU')} ₽
        </Button>
        <Button variant="ghost" size="sm">
          <Icon name="Settings" size={18} />
        </Button>
      </div>
    </div>
  );
};

export default EditorTopToolbar;