import Icon from '@/components/ui/icon';

interface ChatSelectionBarProps {
  selectedCount: number;
  onExit: () => void;
  onSelectAll: () => void;
  onBulkCopy: () => void;
  onBulkRemove: (forAll: boolean) => void;
}

export default function ChatSelectionBar({
  selectedCount,
  onExit,
  onSelectAll,
  onBulkCopy,
  onBulkRemove,
}: ChatSelectionBarProps) {
  return (
    <div className="flex items-center gap-1 p-2 border-b bg-blue-50 dark:bg-blue-950/40">
      <button
        type="button"
        onClick={onExit}
        className="p-2 rounded hover:bg-black/5"
        aria-label="Выйти из режима выбора"
      >
        <Icon name="X" size={18} />
      </button>
      <span className="text-sm font-medium flex-1">Выбрано: {selectedCount}</span>
      <button
        type="button"
        onClick={onSelectAll}
        className="p-2 rounded hover:bg-black/5"
        title="Выбрать все"
      >
        <Icon name="CheckSquare" size={18} />
      </button>
      <button
        type="button"
        onClick={onBulkCopy}
        disabled={selectedCount === 0}
        className="p-2 rounded hover:bg-black/5 disabled:opacity-40"
        title="Скопировать"
      >
        <Icon name="Copy" size={18} />
      </button>
      <button
        type="button"
        onClick={() => onBulkRemove(false)}
        disabled={selectedCount === 0}
        className="p-2 rounded hover:bg-black/5 disabled:opacity-40 text-red-600"
        title="Удалить у себя"
      >
        <Icon name="Trash2" size={18} />
      </button>
      <button
        type="button"
        onClick={() => onBulkRemove(true)}
        disabled={selectedCount === 0}
        className="p-2 rounded hover:bg-black/5 disabled:opacity-40 text-red-600"
        title="Удалить у всех"
      >
        <Icon name="Trash" size={18} />
      </button>
    </div>
  );
}
