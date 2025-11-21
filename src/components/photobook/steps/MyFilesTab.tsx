import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import type { UploadedPhoto } from '../PhotobookCreator';

interface MyFilesTabProps {
  uploadedPhotos: UploadedPhoto[];
  selectedPhotos: Set<string>;
  searchQuery: string;
  view: 'grid' | 'list';
  newUploadsCount: number;
  todayUploadsCount: number;
  unselectedCount: number;
  onSearchQueryChange: (query: string) => void;
  onViewChange: () => void;
  onSelectAll: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTogglePhotoSelection: (photoId: string) => void;
}

const MyFilesTab = ({
  uploadedPhotos,
  selectedPhotos,
  searchQuery,
  view,
  newUploadsCount,
  todayUploadsCount,
  unselectedCount,
  onSearchQueryChange,
  onViewChange,
  onSelectAll,
  onFileUpload,
  onTogglePhotoSelection
}: MyFilesTabProps) => {
  return (
    <div className="grid grid-cols-[250px_1fr] flex-1 overflow-hidden">
      <div className="border-r p-4 overflow-y-auto">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">Дата загрузки файлов</h3>
          <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
            <span className="text-sm">Все мои файлы</span>
            <span className="text-xs text-muted-foreground">{uploadedPhotos.length}</span>
          </div>
          <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
            <span className="text-sm">Новые загрузки</span>
            <span className="text-xs text-muted-foreground">{newUploadsCount}</span>
          </div>
          <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
            <span className="text-sm">Загруженные сегодня</span>
            <span className="text-xs text-muted-foreground">{todayUploadsCount}</span>
          </div>
          <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
            <span className="text-sm">Без альбома</span>
            <span className="text-xs text-muted-foreground">{unselectedCount}</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-muted-foreground">Мои альбомы</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Icon name="Plus" size={16} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Вы еще не создали ни одного альбома
          </p>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Поиск изображений"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button 
            variant="outline"
            onClick={onViewChange}
          >
            <Icon name={view === 'grid' ? 'List' : 'Grid3x3'} size={18} />
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon">
              <Icon name="MoreVertical" size={18} />
            </Button>
            <Button variant="outline" size="icon">
              <Icon name="ArrowDownUp" size={18} />
            </Button>
            <Button 
              variant="outline"
              disabled={uploadedPhotos.length === 0}
              onClick={onSelectAll}
            >
              <Icon name="CheckSquare" size={18} className="mr-2" />
              Выделить все файлы
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {uploadedPhotos.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Icon name="ImageOff" size={64} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Загрузите фотографии для вашей фотокниги</p>
                <label htmlFor="file-upload-empty">
                  <Button asChild>
                    <span>
                      <Icon name="Upload" size={18} className="mr-2" />
                      Загрузить файлы
                    </span>
                  </Button>
                </label>
                <input
                  id="file-upload-empty"
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={onFileUpload}
                />
              </div>
            </div>
          ) : (
            <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 items-start' : 'space-y-2'}>
              {uploadedPhotos.map(photo => {
                const isVertical = photo.height > photo.width;
                const isHorizontal = photo.width > photo.height;
                const isSelected = selectedPhotos.has(photo.id);

                return (
                  <Card
                    key={photo.id}
                    className={`overflow-hidden cursor-pointer transition-all border-2 ${
                      isSelected 
                        ? 'border-purple-600 ring-4 ring-purple-200' 
                        : 'border-transparent hover:border-purple-300'
                    } ${isVertical ? 'row-span-2' : ''}`}
                    onClick={() => onTogglePhotoSelection(photo.id)}
                  >
                    <div className="relative aspect-square">
                      <img
                        src={photo.url}
                        alt={photo.file.name}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1">
                          <Icon name="Check" size={16} className="text-white" />
                        </div>
                      )}
                    </div>
                    {view === 'list' && (
                      <div className="p-2">
                        <p className="text-xs truncate">{photo.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {photo.width} × {photo.height}
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyFilesTab;
