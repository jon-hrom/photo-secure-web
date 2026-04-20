import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import type { ChatAction } from './types';

interface MenuItem {
  action: ChatAction;
  label: string;
  icon: string;
  danger?: boolean;
  show: boolean;
}

interface Props {
  x: number;
  y: number;
  canEdit: boolean;
  canRemoveForAll: boolean;
  hasText: boolean;
  onClose: () => void;
  onAction: (action: ChatAction) => void;
}

export default function MessageContextMenu({
  x,
  y,
  canEdit,
  canRemoveForAll,
  hasText,
  onClose,
  onAction,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const items: MenuItem[] = [
    { action: 'reply', label: 'Ответить', icon: 'Reply', show: true },
    { action: 'edit', label: 'Редактировать сообщение', icon: 'Pencil', show: canEdit && hasText },
    { action: 'copy', label: 'Скопировать текст', icon: 'Copy', show: hasText },
    { action: 'forward', label: 'Переслать', icon: 'Forward', show: true },
    { action: 'pin', label: 'Закрепить', icon: 'Pin', show: true },
    { action: 'select', label: 'Выбрать сообщение', icon: 'CheckSquare', show: true },
    { action: 'remove_me', label: 'Удалить сообщение', icon: 'Trash2', show: true, danger: true },
    { action: 'remove_all', label: 'Удалить у всех', icon: 'Trash', show: canRemoveForAll, danger: true },
  ].filter((i) => i.show);

  const menuWidth = 260;
  const menuHeight = items.length * 44 + 8;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = Math.min(Math.max(8, x), viewportW - menuWidth - 8);
  const top = Math.min(Math.max(8, y), viewportH - menuHeight - 8);

  return (
    <div className="fixed inset-0 z-[9999]" onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={ref}
        role="menu"
        className="absolute bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        style={{ left, top, width: menuWidth }}
      >
        {items.map((item) => (
          <button
            key={item.action}
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              onAction(item.action);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
              item.danger
                ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
                : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Icon name={item.icon} size={17} />
            <span className="flex-1">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
