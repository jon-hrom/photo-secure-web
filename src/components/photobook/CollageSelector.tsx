import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CollageTemplate {
  id: string;
  slots: Array<{ x: number; y: number; width: number; height: number }>;
  thumbnail: string;
}

interface CollageSelectorProps {
  photosPerCollage: 1 | 2 | 3;
  onPhotosPerCollageChange: (value: 1 | 2 | 3) => void;
  collages: CollageTemplate[];
  selectedCollageId: string;
  onCollageSelect: (collageId: string) => void;
}

const CollageSelector = ({
  photosPerCollage,
  onPhotosPerCollageChange,
  collages,
  selectedCollageId,
  onCollageSelect
}: CollageSelectorProps) => {
  return (
    <Card className="w-64 p-4 flex flex-col">
      <h3 className="font-semibold mb-2">Коллажи</h3>
      
      <div className="mb-4">
        <label className="text-sm text-muted-foreground mb-2 block">Количество фото</label>
        <Select
          value={photosPerCollage.toString()}
          onValueChange={(value) => onPhotosPerCollageChange(parseInt(value) as 1 | 2 | 3)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 фото в коллаже</SelectItem>
            <SelectItem value="2">2 фото в коллаже</SelectItem>
            <SelectItem value="3">3 фото в коллаже</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 gap-2">
          {collages.map((collage) => (
            <button
              key={collage.id}
              onClick={() => onCollageSelect(collage.id)}
              className={`border-2 rounded p-1 hover:border-purple-500 transition-colors ${
                selectedCollageId === collage.id ? 'border-purple-600 ring-2 ring-purple-200' : 'border-gray-200'
              }`}
            >
              <img src={collage.thumbnail} alt={`Коллаж ${collage.id}`} className="w-full h-auto" />
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default CollageSelector;
