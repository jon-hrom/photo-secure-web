import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import type { UploadedPhoto } from '../PhotobookCreator';

type LeftPanelTab = 'photos' | 'text' | 'templates' | 'bg' | 'collages' | 'stickers' | 'frames';

interface EditorLeftPanelProps {
  photos: UploadedPhoto[];
  leftPanelTab: LeftPanelTab;
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  textToAdd: string;
  setTextToAdd: (text: string) => void;
}

const EditorLeftPanel = ({
  photos,
  leftPanelTab,
  setLeftPanelTab,
  textToAdd,
  setTextToAdd,
}: EditorLeftPanelProps) => {
  return (
    <>
      {/* Left sidebar - Tools */}
      <div className="w-16 bg-white border-r flex flex-col items-center py-4 gap-4">
        <Button
          variant={leftPanelTab === 'photos' ? 'default' : 'ghost'}
          size="icon"
          className="w-12 h-12 flex flex-col gap-1 text-xs"
          onClick={() => setLeftPanelTab('photos')}
        >
          <Icon name="Image" size={20} />
        </Button>
        <Button
          variant={leftPanelTab === 'text' ? 'default' : 'ghost'}
          size="icon"
          className="w-12 h-12 flex flex-col gap-1 text-xs"
          onClick={() => setLeftPanelTab('text')}
        >
          <Icon name="Type" size={20} />
        </Button>
        <Button
          variant={leftPanelTab === 'templates' ? 'default' : 'ghost'}
          size="icon"
          className="w-12 h-12 flex flex-col gap-1 text-xs"
          onClick={() => setLeftPanelTab('templates')}
        >
          <Icon name="Layout" size={20} />
        </Button>
        <Button
          variant={leftPanelTab === 'bg' ? 'default' : 'ghost'}
          size="icon"
          className="w-12 h-12 flex flex-col gap-1 text-xs"
          onClick={() => setLeftPanelTab('bg')}
        >
          <Icon name="Palette" size={20} />
        </Button>
        <Button
          variant={leftPanelTab === 'collages' ? 'default' : 'ghost'}
          size="icon"
          className="w-12 h-12 flex flex-col gap-1 text-xs"
          onClick={() => setLeftPanelTab('collages')}
        >
          <Icon name="Grid3x3" size={20} />
        </Button>
        <Button
          variant={leftPanelTab === 'stickers' ? 'default' : 'ghost'}
          size="icon"
          className="w-12 h-12 flex flex-col gap-1 text-xs"
          onClick={() => setLeftPanelTab('stickers')}
        >
          <Icon name="Smile" size={20} />
        </Button>
        <Button
          variant={leftPanelTab === 'frames' ? 'default' : 'ghost'}
          size="icon"
          className="w-12 h-12 flex flex-col gap-1 text-xs"
          onClick={() => setLeftPanelTab('frames')}
        >
          <Icon name="Frame" size={20} />
        </Button>
      </div>

      {/* Left panel - Content */}
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Icon name="Image" size={20} />
            Фото
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {leftPanelTab === 'photos' && (
            <div className="space-y-4">
              <Button variant="outline" className="w-full">
                <Icon name="Plus" size={18} className="mr-2" />
                Добавить фото
              </Button>

              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group cursor-move"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('photoId', photo.id);
                    }}
                  >
                    <img
                      src={photo.url}
                      alt="Photo"
                      className="w-full aspect-square object-cover rounded border-2 border-gray-200 hover:border-blue-400 transition-colors"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                      <Icon name="GripVertical" size={24} className="text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {leftPanelTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Добавить текст</label>
                <Input
                  placeholder="Введите текст..."
                  value={textToAdd}
                  onChange={(e) => setTextToAdd(e.target.value)}
                  className="mb-2"
                />
                <Button variant="outline" className="w-full">
                  <Icon name="Plus" size={18} className="mr-2" />
                  Добавить на страницу
                </Button>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Стили текста</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <span className="font-bold">Жирный</span>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <span className="italic">Курсив</span>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <span className="underline">Подчеркнутый</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {leftPanelTab === 'templates' && (
            <div className="space-y-2">
              <p className="text-sm font-medium mb-2">Шаблоны раскладки</p>
              <div className="grid grid-cols-2 gap-2">
                {['2 фото', '3 фото', '4 фото', '5 фото', '6 фото'].map((template) => (
                  <Button
                    key={template}
                    variant="outline"
                    className="h-20 flex flex-col gap-1"
                    size="sm"
                  >
                    <Icon name="LayoutGrid" size={24} />
                    <span className="text-xs">{template}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {leftPanelTab === 'bg' && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Цвет фона</p>
              <div className="grid grid-cols-5 gap-2">
                {['#FFFFFF', '#F3F4F6', '#E5E7EB', '#FEF3C7', '#FEE2E2', '#DBEAFE', '#D1FAE5'].map((color) => (
                  <button
                    key={color}
                    className="w-full aspect-square rounded border-2 hover:border-yellow-400"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}

          {leftPanelTab === 'frames' && (
            <div className="space-y-2">
              <p className="text-sm font-medium mb-2">Рамки для фото</p>
              <div className="space-y-2">
                {['Без рамки', 'Белая', 'Черная', 'Золотая'].map((frame) => (
                  <Button
                    key={frame}
                    variant="outline"
                    className="w-full justify-start"
                    size="sm"
                  >
                    {frame}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EditorLeftPanel;
