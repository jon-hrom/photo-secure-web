import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface ManualModeToolbarProps {
  selectedSlotIndex: number | null;
  isResizing: boolean;
  isShiftPressed: boolean;
  onAddSlot: () => void;
  onDuplicateSlot: () => void;
  onClearPhoto: () => void;
  onDeleteSlot: () => void;
}

const ManualModeToolbar = ({
  selectedSlotIndex,
  isResizing,
  isShiftPressed,
  onAddSlot,
  onDuplicateSlot,
  onClearPhoto,
  onDeleteSlot
}: ManualModeToolbarProps) => {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={onAddSlot}
        >
          <Icon name="Plus" size={16} className="mr-1" />
          Добавить слот
        </Button>
        {selectedSlotIndex !== null && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onDuplicateSlot}
            >
              <Icon name="Copy" size={16} className="mr-1" />
              Дублировать
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearPhoto}
            >
              <Icon name="X" size={16} className="mr-1" />
              Очистить фото
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteSlot}
              className="border-red-300 hover:bg-red-50"
            >
              <Icon name="Trash2" size={16} className="mr-1" />
              Удалить
            </Button>
          </>
        )}
      </div>
      <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 flex items-start gap-2">
        <Icon name="Info" size={14} className="mt-0.5 flex-shrink-0" />
        <div>
          <strong>Инструкция:</strong> Кликните на слот для выбора → Перетаскивайте за центр → Изменяйте размер за фиолетовые углы → Зажмите Shift для сохранения пропорций
        </div>
      </div>
      {isResizing && isShiftPressed && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          <Icon name="Lock" size={16} className="inline mr-2" />
          Пропорции зафиксированы
        </div>
      )}
    </div>
  );
};

export default ManualModeToolbar;
