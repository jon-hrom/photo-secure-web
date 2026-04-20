import { forwardRef, type ReactNode, type Ref } from 'react';
import Icon from '@/components/ui/icon';

interface ChatModalLayoutProps {
  embedded: boolean;
  title: string;
  onClose: () => void;
  selectionBar: ReactNode;
  children: ReactNode;
  input: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
  onBackdropClick?: () => void;
}

const ChatModalLayout = forwardRef<HTMLDivElement, ChatModalLayoutProps>(function ChatModalLayout(
  { embedded, title, onClose, selectionBar, children, input, containerRef, onBackdropClick },
  _ref,
) {
  if (embedded) {
    return (
      <div className="w-full h-full flex flex-col bg-background">
        <div className="hidden md:flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Icon name="MessageCircle" size={24} className="text-primary" />
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 hover:bg-muted rounded-full transition-colors touch-manipulation"
          >
            <Icon name="X" size={20} className="text-muted-foreground" />
          </button>
        </div>

        {selectionBar}

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {input}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-2xl h-[90vh] sm:max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'calc(100vh - env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b dark:border-gray-800 safe-top">
          <div className="flex items-center gap-2">
            <Icon name="MessageCircle" size={24} className="text-blue-500" />
            <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors touch-manipulation"
          >
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        {selectionBar}

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {input}
      </div>
    </div>
  );
});

export default ChatModalLayout;
