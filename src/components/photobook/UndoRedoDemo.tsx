import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useUndoRedo } from '@/hooks/useUndoRedo';

interface DemoItem {
  id: string;
  color: string;
  text: string;
}

const UndoRedoDemo = () => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
  
  const {
    state: items,
    setState: setItems,
    undo,
    redo,
    canUndo,
    canRedo,
    historySize,
    currentIndex,
    clearHistory,
  } = useUndoRedo<DemoItem[]>([], 50);

  const addItem = () => {
    const newItem: DemoItem = {
      id: `item-${Date.now()}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      text: `Элемент ${items.length + 1}`,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const changeColor = (id: string) => {
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, color: colors[Math.floor(Math.random() * colors.length)] }
        : item
    ));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Демо: Undo/Redo функциональность</h1>
        <p className="text-muted-foreground">
          Добавляйте элементы, меняйте цвета и используйте отмену/повтор действий
        </p>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button onClick={addItem}>
              <Icon name="Plus" size={18} className="mr-2" />
              Добавить элемент
            </Button>
            <Button onClick={() => setItems([])} variant="outline">
              <Icon name="Trash2" size={18} className="mr-2" />
              Очистить всё
            </Button>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
              title="Отменить (Ctrl+Z)"
              className="relative"
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
              className="relative"
            >
              <Icon name="Redo" size={18} />
              {canRedo && (historySize - currentIndex - 1) > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {historySize - currentIndex - 1}
                </span>
              )}
            </Button>
            <div className="h-6 w-px bg-gray-300 mx-1" />
            <span className="text-sm text-muted-foreground">
              История: {historySize}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="p-4 transition-all hover:shadow-lg"
              style={{ backgroundColor: item.color }}
            >
              <div className="text-center mb-2">
                <p className="font-semibold text-white drop-shadow-lg">{item.text}</p>
              </div>
              <div className="flex gap-1 justify-center">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => changeColor(item.id)}
                  className="flex-1"
                >
                  <Icon name="Palette" size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeItem(item.id)}
                >
                  <Icon name="X" size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="Package" size={48} className="mx-auto mb-2 opacity-50" />
            <p>Нет элементов. Добавьте первый элемент!</p>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={20} className="text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Горячие клавиши:</p>
            <ul className="space-y-1">
              <li><kbd className="px-1.5 py-0.5 bg-white rounded text-xs">Ctrl+Z</kbd> - Отменить</li>
              <li><kbd className="px-1.5 py-0.5 bg-white rounded text-xs">Ctrl+Shift+Z</kbd> или <kbd className="px-1.5 py-0.5 bg-white rounded text-xs">Ctrl+Y</kbd> - Повторить</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default UndoRedoDemo;
