import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface PhotobookUploadFooterProps {
  selectedPhotosCount: number;
  requiredPhotos: number;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onContinue: () => void;
}

const PhotobookUploadFooter = ({
  selectedPhotosCount,
  requiredPhotos,
  onFileUpload,
  onContinue
}: PhotobookUploadFooterProps) => {
  return (
    <div className="border-t p-4 flex items-center justify-between bg-gray-50">
      <div className="text-sm">
        <span className="font-semibold">Выбрано: {selectedPhotosCount}</span>
        <label htmlFor="file-upload-bottom" className="ml-4">
          <Button variant="outline" size="sm" className="ml-2" asChild>
            <span>
              <Icon name="Upload" size={16} className="mr-2" />
              Загрузить еще
            </span>
          </Button>
        </label>
        <input
          id="file-upload-bottom"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onFileUpload}
        />
      </div>
      <div className="flex items-center gap-4">
        {selectedPhotosCount < requiredPhotos && (
          <span className="text-sm text-muted-foreground">
            Минимум {requiredPhotos} фото
          </span>
        )}
        <Button
          onClick={onContinue}
          disabled={selectedPhotosCount < requiredPhotos}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Продолжить
          <Icon name="ArrowRight" size={18} className="ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default PhotobookUploadFooter;
