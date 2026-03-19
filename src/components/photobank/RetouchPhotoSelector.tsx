import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';

interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  data_url?: string;
}

interface RetouchPhotoSelectorProps {
  photos: Photo[];
  loadingPhotos: boolean;
  selectedPhotoId: number | null;
  onSelectPhoto: (id: number) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  submitting: boolean;
  waking: boolean;
  onRetouchSingle: () => void;
  onRetouchAll: () => void;
}

const getPhotoThumb = (photo: Photo) => {
  return photo.thumbnail_s3_url || photo.data_url || photo.s3_url || '';
};

const RetouchPhotoSelector = ({
  photos,
  loadingPhotos,
  selectedPhotoId,
  onSelectPhoto,
  activeTab,
  onTabChange,
  submitting,
  waking,
  onRetouchSingle,
  onRetouchAll,
}: RetouchPhotoSelectorProps) => {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="single" className="text-sm">
          <Icon name="Image" size={14} className="mr-1.5" />
          Одно фото
        </TabsTrigger>
        <TabsTrigger value="all" className="text-sm">
          <Icon name="Images" size={14} className="mr-1.5" />
          Вся папка
        </TabsTrigger>
      </TabsList>

      <TabsContent value="single" className="mt-4">
        {loadingPhotos ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="Loader2" size={24} className="animate-spin mx-auto mb-2" />
            Загрузка фото...
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="ImageOff" size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">В папке нет фотографий</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Выберите фото для ретуши:
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => onSelectPhoto(photo.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 ${
                    selectedPhotoId === photo.id
                      ? 'border-rose-500 ring-2 ring-rose-300 shadow-lg'
                      : 'border-transparent hover:border-rose-200'
                  }`}
                >
                  <img
                    src={getPhotoThumb(photo)}
                    alt={photo.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {selectedPhotoId === photo.id && (
                    <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                      <Icon name="Check" size={24} className="text-white drop-shadow-lg" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={onRetouchSingle}
                disabled={!selectedPhotoId || submitting || waking}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {submitting ? (
                  <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                ) : (
                  <Icon name="Sparkles" size={16} className="mr-2" />
                )}
                Отретушировать
              </Button>
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="all" className="mt-4">
        {loadingPhotos ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="Loader2" size={24} className="animate-spin mx-auto mb-2" />
            Загрузка...
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="ImageOff" size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">В папке нет фотографий</p>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30">
              <Icon name="Images" size={32} className="text-rose-600" />
            </div>
            <div>
              <p className="font-medium">Ретушь всей папки</p>
              <p className="text-sm text-muted-foreground mt-1">
                Будет обработано фото: {photos.length}
              </p>
            </div>
            <Button
              onClick={onRetouchAll}
              disabled={submitting || waking}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              size="lg"
            >
              {submitting ? (
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
              ) : (
                <Icon name="Sparkles" size={16} className="mr-2" />
              )}
              {submitting ? 'Запуск ретуши...' : 'Отретушировать все фото'}
            </Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default RetouchPhotoSelector;
