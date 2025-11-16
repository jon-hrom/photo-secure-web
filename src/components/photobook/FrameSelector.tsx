import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FrameSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectFrame: (frameId: string | null) => void;
}

const FRAMES = [
  { id: null, name: 'Без рамки', preview: null },
  { id: 'simple-white', name: 'Белая', color: '#FFFFFF', width: 20 },
  { id: 'simple-black', name: 'Черная', color: '#000000', width: 20 },
  { id: 'simple-gray', name: 'Серая', color: '#9CA3AF', width: 20 },
  { id: 'thick-white', name: 'Белая толстая', color: '#FFFFFF', width: 40 },
  { id: 'thick-black', name: 'Черная толстая', color: '#000000', width: 40 },
  { id: 'gold', name: 'Золотая', color: '#FFD700', width: 25 },
  { id: 'silver', name: 'Серебряная', color: '#C0C0C0', width: 25 },
];

const FrameSelector = ({ open, onClose, onSelectFrame }: FrameSelectorProps) => {
  const handleSelect = (frameId: string | null) => {
    onSelectFrame(frameId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Выберите рамку</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-4 py-4">
          {FRAMES.map((frame) => (
            <Card
              key={frame.id || 'none'}
              className="p-4 cursor-pointer hover:shadow-lg transition-all hover:border-yellow-400"
              onClick={() => handleSelect(frame.id)}
            >
              <div className="aspect-square mb-2 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                {frame.id ? (
                  <div 
                    className="w-full h-full"
                    style={{
                      border: `${frame.width}px solid ${frame.color}`,
                      boxShadow: frame.id.includes('gold') || frame.id.includes('silver') 
                        ? 'inset 0 0 10px rgba(0,0,0,0.2)' 
                        : 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                )}
              </div>
              <p className="text-sm text-center font-medium">{frame.name}</p>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FrameSelector;
