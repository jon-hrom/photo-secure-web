import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface PhotoToolbarProps {
  onFrame: () => void;
  onReplace: () => void;
  onCrop: () => void;
  onTransparency: () => void;
  onMakeBackground: () => void;
  onClear: () => void;
  onStyle: () => void;
}

const PhotoToolbar = ({
  onFrame,
  onReplace,
  onCrop,
  onTransparency,
  onMakeBackground,
  onClear,
  onStyle
}: PhotoToolbarProps) => {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 bg-white rounded-lg shadow-lg p-2 border-2 border-gray-200">
      <Button
        size="icon"
        variant="ghost"
        className="flex flex-col gap-1 h-auto py-2 px-3"
        onClick={onFrame}
      >
        <Icon name="Frame" size={20} />
        <span className="text-xs">Рамки</span>
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="flex flex-col gap-1 h-auto py-2 px-3"
        onClick={onReplace}
      >
        <Icon name="RefreshCw" size={20} />
        <span className="text-xs">Заменить</span>
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="flex flex-col gap-1 h-auto py-2 px-3"
        onClick={onCrop}
      >
        <Icon name="Crop" size={20} />
        <span className="text-xs">Кадрировать</span>
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="flex flex-col gap-1 h-auto py-2 px-3"
        onClick={onTransparency}
      >
        <Icon name="Droplet" size={20} />
        <span className="text-xs">Прозрачность</span>
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="flex flex-col gap-1 h-auto py-2 px-3"
        onClick={onMakeBackground}
      >
        <Icon name="Image" size={20} />
        <span className="text-xs">Сделать фоном</span>
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="flex flex-col gap-1 h-auto py-2 px-3"
        onClick={onClear}
      >
        <Icon name="Eraser" size={20} />
        <span className="text-xs">Очистить фото</span>
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="flex flex-col gap-1 h-auto py-2 px-3"
        onClick={onStyle}
      >
        <Icon name="Palette" size={20} />
        <span className="text-xs">Стиль</span>
      </Button>
    </div>
  );
};

export default PhotoToolbar;
