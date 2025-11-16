import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface TransparencyToolProps {
  open: boolean;
  onClose: () => void;
  photoUrl: string;
  currentOpacity?: number;
  onApply: (opacity: number) => void;
}

const TransparencyTool = ({ 
  open, 
  onClose, 
  photoUrl, 
  currentOpacity = 1,
  onApply 
}: TransparencyToolProps) => {
  const [opacity, setOpacity] = useState(currentOpacity);

  const handleApply = () => {
    onApply(opacity);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Настроить прозрачность</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="relative w-full h-[400px] bg-gray-100 rounded overflow-hidden flex items-center justify-center">
            <div 
              className="absolute inset-0" 
              style={{
                backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f3f4f6 0% 50%)',
                backgroundPosition: '0 0, 10px 10px',
                backgroundSize: '20px 20px'
              }}
            />
            <img
              src={photoUrl}
              alt="Transparency preview"
              className="relative max-w-full max-h-full object-contain"
              style={{ opacity }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Прозрачность: {Math.round(opacity * 100)}%
              </label>
              <span className="text-sm text-muted-foreground">
                Непрозрачность: {Math.round((1 - opacity) * 100)}%
              </span>
            </div>
            <Slider
              value={[opacity]}
              onValueChange={(value) => setOpacity(value[0])}
              min={0}
              max={1}
              step={0.01}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpacity(1)}>
            Сбросить
          </Button>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
            onClick={handleApply}
          >
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransparencyTool;
