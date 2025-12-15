import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  reorderShootingStyle,
} from '@/data/shootingStyles';
import { toast } from 'sonner';

interface ShootingStyleSelectorProps {
  value?: string;
  onChange: (styleId: string) => void;
}

export function ShootingStyleSelector({ value, onChange }: ShootingStyleSelectorProps) {
  const [styles, setStyles] = useState<ShootingStyle[]>([]);
  const [newStyleName, setNewStyleName] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

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

  const handleReorder = (styleId: string, direction: 'up' | 'down') => {
    reorderShootingStyle(styleId, direction);
    loadStyles();
  };

  const selectedStyle = styles.find(s => s.id === value);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Выберите стиль съёмки">
              {selectedStyle?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {styles.map((style, index) => (
              <SelectItem key={style.id} value={style.id}>
                <div className="flex items-center justify-between w-full gap-4">
                  <span className="flex-1 text-left">{style.name}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(style.id, 'up');
                      }}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === styles.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(style.id, 'down');
                      }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
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
