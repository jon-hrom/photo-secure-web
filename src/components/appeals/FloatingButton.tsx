import Icon from '@/components/ui/icon';

interface FloatingButtonProps {
  isDragging: boolean;
  position: { x: number; y: number };
  badgeCount: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const FloatingButton = ({ isDragging, position, badgeCount, onMouseDown, onClick }: FloatingButtonProps) => {
  return (
    <div
      className={`fixed z-50 flex items-center justify-center cursor-move ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '80px',
        height: '80px',
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-200 border-4 border-white">
          <Icon name="Mail" size={32} className="text-white" />
        </div>
        {badgeCount > 0 && (
          <div className="absolute -top-1 -right-1 min-w-8 h-8 px-1 rounded-full bg-red-500 border-4 border-white flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-white font-bold text-sm">{badgeCount}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingButton;
