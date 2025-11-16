import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';

interface CropToolProps {
  open: boolean;
  onClose: () => void;
  photoUrl: string;
  onApply: (crop: { x: number; y: number; width: number; height: number; scale: number }) => void;
}

const CropTool = ({ open, onClose, photoUrl, onApply }: CropToolProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleApply = () => {
    onApply({
      x: position.x,
      y: position.y,
      width: 400,
      height: 300,
      scale,
    });
    onClose();
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Кадрировать фото</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="relative w-full h-[400px] bg-gray-100 rounded overflow-hidden cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={photoUrl}
              alt="Crop preview"
              className="absolute pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'top left',
              }}
              draggable={false}
            />
            <div className="absolute inset-0 border-4 border-yellow-400 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-400 rounded-full pointer-events-none" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Масштаб: {scale.toFixed(2)}x</label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale(s => Math.max(0.1, s - 0.1))}
                >
                  <Icon name="ZoomOut" size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale(s => Math.min(3, s + 0.1))}
                >
                  <Icon name="ZoomIn" size={16} />
                </Button>
              </div>
            </div>
            <Slider
              value={[scale]}
              onValueChange={(value) => setScale(value[0])}
              min={0.1}
              max={3}
              step={0.01}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            <Icon name="RotateCcw" size={16} className="mr-2" />
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

export default CropTool;
