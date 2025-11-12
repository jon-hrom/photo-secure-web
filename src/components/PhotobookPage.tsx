import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Photo {
  id: number;
  url: string;
  orientation: 'horizontal' | 'vertical';
}

interface Photobook {
  id: number;
  title: string;
  photos: Photo[];
  layout: 'classic' | 'modern' | 'magazine';
  status: 'draft' | 'inProgress' | 'completed';
}

const PhotobookPage = () => {
  const [photobooks, setPhotobooks] = useState<Photobook[]>([
    {
      id: 1,
      title: 'Свадьба Ивановых',
      photos: [],
      layout: 'classic',
      status: 'inProgress',
    },
    {
      id: 2,
      title: 'Детская фотосессия',
      photos: [],
      layout: 'modern',
      status: 'draft',
    },
  ]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPhotobook, setSelectedPhotobook] = useState<Photobook | null>(null);

  const layouts = [
    { id: 'classic', name: 'Классический', description: 'Традиционное расположение фото' },
    { id: 'modern', name: 'Современный', description: 'Динамичное размещение' },
    { id: 'magazine', name: 'Журнальный', description: 'Стиль глянцевого журнала' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Черновик</Badge>;
      case 'inProgress':
        return <Badge className="bg-blue-500">В работе</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Завершено</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Макет фотокниг</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-lg hover-scale">
              <Icon name="Plus" size={20} className="mr-2" />
              Создать фотокнигу
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Новая фотокнига</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-muted-foreground">
                Выберите макет для автоматической вёрстки фотокниги
              </p>
              <div className="grid gap-4">
                {layouts.map((layout) => (
                  <Card key={layout.id} className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-1">{layout.name}</h3>
                          <p className="text-sm text-muted-foreground">{layout.description}</p>
                        </div>
                        <Icon name="ChevronRight" className="text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Icon name="Book" className="mr-2 text-primary" size={24} />
                Мои проекты ({photobooks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {photobooks.map((book) => (
                <Card
                  key={book.id}
                  className="cursor-pointer hover:shadow-md transition-all border-2"
                  onClick={() => setSelectedPhotobook(book)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{book.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Макет: {layouts.find(l => l.id === book.layout)?.name}
                        </p>
                      </div>
                      {getStatusBadge(book.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Icon name="Image" size={16} />
                        <span>{book.photos.length} фото</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="FileText" size={16} />
                        <span>0 страниц</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-lg border-2 bg-gradient-to-br from-purple-50 to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Icon name="Sparkles" className="mr-2 text-primary" size={24} />
                Автоматическая вёрстка
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded-full mt-1">
                    <Icon name="Wand2" className="text-primary" size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Умное размещение</h4>
                    <p className="text-sm text-muted-foreground">
                      Автоматический выбор лучшего расположения на основе ориентации фото
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-secondary/10 p-2 rounded-full mt-1">
                    <Icon name="Layout" className="text-secondary" size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Адаптивные макеты</h4>
                    <p className="text-sm text-muted-foreground">
                      Горизонтальные и вертикальные фото идеально сочетаются
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-accent/10 p-2 rounded-full mt-1">
                    <Icon name="Zap" className="text-accent" size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Быстрая генерация</h4>
                    <p className="text-sm text-muted-foreground">
                      Создание макета за считанные секунды
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedPhotobook && (
            <Card className="shadow-lg border-2 animate-scale-in">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{selectedPhotobook.title}</span>
                  {getStatusBadge(selectedPhotobook.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="rounded-xl">
                    <Icon name="Upload" size={18} className="mr-2" />
                    Загрузить фото
                  </Button>
                  <Button variant="outline" className="rounded-xl">
                    <Icon name="Settings" size={18} className="mr-2" />
                    Настройки
                  </Button>
                </div>

                <div className="p-4 bg-muted/50 rounded-xl text-center">
                  <Icon name="ImagePlus" size={48} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Загрузите фотографии для начала работы
                  </p>
                </div>

                <Button className="w-full rounded-xl">
                  <Icon name="Play" size={18} className="mr-2" />
                  Начать вёрстку
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="shadow-lg border-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Icon name="Info" className="mr-2 text-primary" size={24} />
            Как это работает
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center space-y-2">
              <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <span className="text-primary font-bold text-xl">1</span>
              </div>
              <h4 className="font-semibold">Загрузите фото</h4>
              <p className="text-sm text-muted-foreground">
                Добавьте все фотографии для фотокниги
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="bg-secondary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <span className="text-secondary font-bold text-xl">2</span>
              </div>
              <h4 className="font-semibold">Выберите макет</h4>
              <p className="text-sm text-muted-foreground">
                Определите стиль расположения фотографий
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="bg-accent/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <span className="text-accent font-bold text-xl">3</span>
              </div>
              <h4 className="font-semibold">Получите результат</h4>
              <p className="text-sm text-muted-foreground">
                Система автоматически создаст макет книги
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PhotobookPage;
