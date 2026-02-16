import { useState, useEffect } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShootingStyle } from '@/components/clients/ClientsTypes';
import {
  getShootingStyles,
  addShootingStyle,
  saveShootingStyles,
} from '@/data/shootingStyles';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ShootingStyleSelectorProps {
  value?: string;
  onChange: (styleId: string) => void;
}

interface SortableItemProps {
  style: ShootingStyle;
  isSelected: boolean;
  onClick: () => void;
}

function SortableItem({ style, isSelected, onClick }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: style.id });

  const styleTransform = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={styleTransform}
      className={`flex items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer select-none ${
        isDragging 
          ? 'opacity-50 bg-accent border-purple-300 shadow-lg z-50' 
          : isSelected
          ? 'bg-gradient-to-r from-purple-100 to-pink-100 border-purple-300'
          : 'border-border hover:bg-accent hover:border-purple-200'
      }`}
      onClick={onClick}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-accent rounded"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <span className={`flex-1 text-sm ${isSelected ? 'font-semibold' : ''}`}>
        {style.name}
      </span>
    </div>
  );
}

export function ShootingStyleSelector({ value, onChange }: ShootingStyleSelectorProps) {
  const [styles, setStyles] = useState<ShootingStyle[]>([]);
  const [newStyleName, setNewStyleName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadStyles();
  }, []);

  const loadStyles = () => {
    const loadedStyles = getShootingStyles();
    setStyles(loadedStyles.sort((a, b) => a.order - b.order));
  };

  const handleAddStyle = () => {
    if (!newStyleName.trim()) {
      toast.error('Введите название стиля');
      return;
    }
    
    addShootingStyle(newStyleName.trim());
    loadStyles();
    setNewStyleName('');
    setIsAddDialogOpen(false);
    toast.success('Стиль добавлен');
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = styles.findIndex((s) => s.id === active.id);
      const newIndex = styles.findIndex((s) => s.id === over.id);

      const newStyles = arrayMove(styles, oldIndex, newIndex).map((s, idx) => ({
        ...s,
        order: idx + 1,
      }));

      setStyles(newStyles);
      saveShootingStyles(newStyles);
      toast.success('Порядок обновлён');
    }
  };

  const handleSelectStyle = (styleId: string) => {
    console.log('[ShootingStyleSelector] handleSelectStyle called with styleId:', styleId);
    console.log('[ShootingStyleSelector] onChange function:', onChange);
    onChange(styleId);
    console.log('[ShootingStyleSelector] onChange called successfully');
    setIsDialogOpen(false);
  };

  const selectedStyle = styles.find(s => s.id === value);
  const activeStyle = activeId ? styles.find(s => s.id === activeId) : null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1 justify-between">
              <span className="truncate dark:text-white">
                {selectedStyle?.name || 'Выберите стиль съёмки'}
              </span>
              <GripVertical className="h-4 w-4 ml-2 shrink-0" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[600px]">
            <DialogHeader>
              <DialogTitle>Выберите стиль съёмки</DialogTitle>
              <DialogDescription>
                Нажмите на строку для выбора или перетащите для изменения порядка
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-2 max-h-[400px]">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={styles.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {styles.map((style) => (
                      <SortableItem
                        key={style.id}
                        style={style}
                        isSelected={style.id === value}
                        onClick={() => handleSelectStyle(style.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
                
                <DragOverlay>
                  {activeStyle ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-card shadow-xl border-purple-300">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                      <span className="flex-1 text-sm">{activeStyle.name}</span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>

            <DialogFooter className="flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(true)}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить стиль
              </Button>
              {value && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    onChange('');
                    setIsDialogOpen(false);
                  }}
                  size="icon"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить новый стиль</DialogTitle>
              <DialogDescription>
                Введите название нового стиля съёмки
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="style-name">Название стиля</Label>
                <Input
                  id="style-name"
                  value={newStyleName}
                  onChange={(e) => setNewStyleName(e.target.value)}
                  placeholder="Например: Космическая съёмка"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddStyle();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleAddStyle}>Добавить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}