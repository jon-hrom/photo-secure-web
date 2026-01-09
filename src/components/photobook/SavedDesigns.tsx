import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import type { PhotobookData } from './PhotobookCreator';
import { formatLocalDate } from '@/utils/dateFormat';

interface SavedDesignsProps {
  designs: PhotobookData[];
  onOpen: (design: PhotobookData) => void;
  onDelete: (designId: string) => void;
}

const SavedDesigns = ({ designs, onOpen, onDelete }: SavedDesignsProps) => {
  if (designs.length === 0) {
    return (
      <div className="text-center py-12">
        <Icon name="FolderOpen" size={64} className="mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground text-lg mb-2">Пока нет сохраненных дизайнов</p>
        <p className="text-sm text-muted-foreground">
          Создайте свой первый дизайн фотокниги
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {designs.map((design) => (
        <Card key={design.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg mb-2">{design.title}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {design.config.format.replace('x', '×')} см
                  </Badge>
                  <Badge variant="outline">
                    {design.spreads.length} разворотов
                  </Badge>
                  <Badge variant="outline">
                    {design.photos.length} фото
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => onDelete(design.id)}
              >
                <Icon name="Trash2" size={18} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {design.photos[0] ? (
                  <img
                    src={design.photos[0].url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Icon name="Image" size={48} className="text-gray-400" />
                )}
              </div>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Создано: {formatLocalDate(design.createdAt, 'date')}</span>
                {design.enableClientLink && (
                  <Badge variant="default" className="bg-green-100 text-green-700">
                    <Icon name="Link" size={12} className="mr-1" />
                    Есть ссылка
                  </Badge>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpen(design)}
              >
                <Icon name="Eye" size={18} className="mr-2" />
                Открыть дизайн
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SavedDesigns;