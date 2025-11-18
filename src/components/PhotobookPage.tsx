import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PhotobookCreator, { type PhotobookData } from '@/components/photobook/PhotobookCreator';
import SavedDesigns from '@/components/photobook/SavedDesigns';
import Photobook3DPreview from '@/components/photobook/Photobook3DPreview';
import { useToast } from '@/hooks/use-toast';

const DESIGNS_API = 'https://functions.poehali.dev/66f4d0c4-09f1-4fa4-a26b-0b623562c751';

const PhotobookPage = () => {
  const [photobooks, setPhotobooks] = useState<PhotobookData[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPhotobook, setSelectedPhotobook] = useState<PhotobookData | null>(null);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const userId = localStorage.getItem('userId') || '1';

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${DESIGNS_API}?action=list`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      
      const designs = (data.designs || []).map((d: any) => ({
        id: String(d.id),
        title: d.title,
        config: d.config,
        method: d.method,
        fillMethod: d.fill_method,
        template: d.template,
        spreads: d.spreads,
        photos: (d.photos || []).map((p: any) => ({
          id: String(p.id),
          url: p.url,
          file: null,
          width: 0,
          height: 0
        })),
        createdAt: new Date(d.created_at),
        enableClientLink: d.enable_client_link,
        clientLinkId: d.client_link_id
      }));
      
      setPhotobooks(designs);
    } catch (error) {
      console.error('Failed to load designs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
  }, []);

  const handlePhotobookComplete = async (photobookData: PhotobookData) => {
    try {
      const res = await fetch(DESIGNS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          title: photobookData.title,
          config: photobookData.config,
          method: photobookData.method,
          fillMethod: photobookData.fillMethod,
          template: photobookData.template,
          spreads: photobookData.spreads,
          photos: photobookData.photos.map(p => ({ url: p.url })),
          enableClientLink: photobookData.enableClientLink
        })
      });

      if (res.ok) {
        toast({
          title: 'Успешно',
          description: `Дизайн "${photobookData.title}" сохранен`
        });
        fetchDesigns();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить дизайн',
        variant: 'destructive'
      });
    }
    setIsCreateDialogOpen(false);
  };

  const handleSelectPhotobook = (photobook: PhotobookData) => {
    setSelectedPhotobook(photobook);
    setShow3DPreview(true);
  };

  const handleDeletePhotobook = async (id: string) => {
    try {
      await fetch(DESIGNS_API, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ id })
      });

      toast({
        title: 'Успешно',
        description: 'Дизайн удален'
      });
      fetchDesigns();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить дизайн',
        variant: 'destructive'
      });
    }
  };

  const handleDownload = () => {
    console.log('Downloading...');
  };

  const handleOrder = () => {
    console.log('Ordering...');
    setShow3DPreview(false);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h2 className="text-2xl md:text-3xl font-bold">Макет фотокниг</h2>
        <Button 
          className="rounded-full shadow-lg hover-scale w-full md:w-auto"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Icon name="Plus" size={20} className="mr-2" />
          Создать фотокнигу
        </Button>
      </div>

      <PhotobookCreator
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onComplete={handlePhotobookComplete}
      />

      {selectedPhotobook && (
        <Photobook3DPreview
          open={show3DPreview}
          config={selectedPhotobook.config}
          spreads={selectedPhotobook.spreads}
          photos={selectedPhotobook.photos}
          onClose={() => {
            setShow3DPreview(false);
            setSelectedPhotobook(null);
          }}
          onDownload={handleDownload}
          onOrder={handleOrder}
        />
      )}

      <Card className="shadow-lg border-2 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Icon name="Book" className="mr-2 text-primary" size={24} />
            Мои дизайны ({photobooks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SavedDesigns
            designs={photobooks}
            onOpen={handleSelectPhotobook}
            onDelete={handleDeletePhotobook}
          />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-lg border-2 bg-gradient-to-br from-purple-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Icon name="LayoutTemplate" className="mr-2 text-primary" size={24} />
              Редактор коллажей
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-full mt-1">
                  <Icon name="Wand2" className="text-primary" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Распознавание лиц</h4>
                  <p className="text-sm text-muted-foreground">
                    Автоматическое обнаружение и защита лиц при размещении фото
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-secondary/10 p-2 rounded-full mt-1">
                  <Icon name="Grid3x3" className="text-secondary" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Готовые шаблоны</h4>
                  <p className="text-sm text-muted-foreground">
                    Более 50 шаблонов коллажей для 1-4 фотографий
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-accent/10 p-2 rounded-full mt-1">
                  <Icon name="Ruler" className="text-accent" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Точное размещение</h4>
                  <p className="text-sm text-muted-foreground">
                    Линейки и сохранение пропорций для идеальных макетов
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-2 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Icon name="Edit" className="mr-2 text-blue-600" size={24} />
              Ручной режим
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-full mt-1">
                  <Icon name="Move" className="text-blue-600" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Перемещение слотов</h4>
                  <p className="text-sm text-muted-foreground">
                    Перетаскивайте слоты мышью для идеальной компоновки
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-full mt-1">
                  <Icon name="Maximize2" className="text-blue-600" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Изменение размера</h4>
                  <p className="text-sm text-muted-foreground">
                    Зажмите Shift для сохранения пропорций при изменении размера
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-full mt-1">
                  <Icon name="Plus" className="text-blue-600" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Добавление слотов</h4>
                  <p className="text-sm text-muted-foreground">
                    Создавайте свои уникальные макеты с любым количеством слотов
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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