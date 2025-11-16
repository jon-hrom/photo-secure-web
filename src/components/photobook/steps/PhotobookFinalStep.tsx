import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import type { PhotobookConfig, UploadedPhoto, PhotoSlot } from '../PhotobookCreator';

interface PhotobookFinalStepProps {
  config: PhotobookConfig;
  spreads: Array<{ id: string; slots: PhotoSlot[] }>;
  photos: UploadedPhoto[];
  onComplete: (title: string, enableClientLink: boolean) => void;
  onBack: () => void;
}

const PhotobookFinalStep = ({ config, spreads, photos, onComplete, onBack }: PhotobookFinalStepProps) => {
  const [title, setTitle] = useState(`Фотокнига ${config.format.replace('x', '×')} см`);
  const [enableClientLink, setEnableClientLink] = useState(false);

  const handleComplete = () => {
    onComplete(title, enableClientLink);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-2xl font-bold">Финальные настройки</h2>
        <div className="w-10" />
      </div>

      <div className="space-y-8">
        <div className="bg-gray-100 p-8 rounded-lg text-center">
          <Icon name="BookOpen" size={64} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-semibold mb-2">Ваша фотокнига готова!</p>
          <p className="text-muted-foreground">
            Формат: {config.format.replace('x', '×')} см | Разворотов: {spreads.length} | Фото: {photos.length}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Название фотокниги</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название"
              className="mt-2"
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="client-link">Создать ссылку для клиента</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Клиент сможет просмотреть макет и оставить комментарии
              </p>
            </div>
            <Switch
              id="client-link"
              checked={enableClientLink}
              onCheckedChange={setEnableClientLink}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t">
          <div className="text-xl font-bold">
            Итого: {config.price.toLocaleString('ru-RU')} ₽
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg">
              <Icon name="Download" size={20} className="mr-2" />
              Скачать PDF
            </Button>
            <Button
              size="lg"
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              onClick={handleComplete}
            >
              Завершить
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotobookFinalStep;
