import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { UploadedPhoto } from './PhotobookCreator';

interface PhotobookPhotoUploaderProps {
  requiredPhotos: number;
  onUpload: (photos: UploadedPhoto[]) => void;
  onBack: () => void;
}

const PhotobookPhotoUploader = ({
  requiredPhotos,
  onUpload,
  onBack,
}: PhotobookPhotoUploaderProps) => {
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const selectedBgId = localStorage.getItem('uploadPageBackground');
    if (selectedBgId) {
      const savedImages = localStorage.getItem('backgroundImages');
      if (savedImages) {
        const images = JSON.parse(savedImages);
        const selectedImage = images.find((img: any) => img.id === selectedBgId);
        if (selectedImage) {
          setBackgroundImage(selectedImage.url);
        }
      }
    }
  }, []);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    setIsUploading(true);
    const newPhotos: UploadedPhoto[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      const img = new Image();

      await new Promise<void>((resolve) => {
        reader.onload = (e) => {
          img.onload = () => {
            newPhotos.push({
              id: `photo-${Date.now()}-${i}`,
              url: e.target?.result as string,
              file,
              width: img.width,
              height: img.height,
            });
            resolve();
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    }

    setUploadedPhotos((prev) => [...prev, ...newPhotos]);
    setIsUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemovePhoto = (photoId: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleContinue = () => {
    onUpload(uploadedPhotos);
  };

  return (
    <div 
      className="min-h-screen p-6 -m-6"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className={`space-y-6 ${backgroundImage ? 'bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg' : ''}`}>
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">Загрузите фотографии</h3>
          <p className="text-muted-foreground">
            Требуется минимум {requiredPhotos} {requiredPhotos === 1 ? 'фотография' : 'фотографий'}
          </p>
        </div>

        <Card className="border-2">
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-primary'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="space-y-4">
              <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <Icon name="Upload" size={40} className="text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold mb-2">
                  Перетащите файлы сюда или нажмите для выбора
                </p>
                <p className="text-sm text-muted-foreground">
                  Поддерживаются форматы: JPG, PNG, WEBP
                </p>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full"
              >
                <Icon name="FolderOpen" size={18} className="mr-2" />
                Выбрать файлы
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>
          </div>
        </CardContent>
        </Card>

        {uploadedPhotos.length > 0 && (
          <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">
                Загружено фотографий: {uploadedPhotos.length}
              </h4>
              {uploadedPhotos.length >= requiredPhotos && (
                <div className="flex items-center gap-2 text-green-600">
                  <Icon name="CheckCircle" size={20} />
                  <span className="text-sm font-medium">Готово к продолжению</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {uploadedPhotos.map((photo, index) => {
                const isHorizontal = photo.width > photo.height;
                return (
                  <div 
                    key={photo.id} 
                    className="relative group animate-scale-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`relative overflow-hidden rounded-lg border-2 border-gray-200 ${
                      isHorizontal ? 'aspect-[4/3]' : 'aspect-[3/4]'
                    }`}>
                      <img
                        src={photo.url}
                        alt="Uploaded"
                        className="w-full h-full object-contain bg-gray-50"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {isHorizontal ? '📐 Гориз.' : '📏 Верт.'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                );
              })}
              {isUploading && (
                <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-primary bg-primary/5 flex items-center justify-center animate-pulse">
                  <Icon name="Loader2" size={32} className="text-primary animate-spin" />
                </div>
              )}
            </div>
          </CardContent>
          </Card>
        )}

        <div className="flex justify-between gap-4">
          <Button variant="outline" onClick={onBack} className="rounded-full">
            <Icon name="ArrowLeft" size={18} className="mr-2" />
            Назад
          </Button>
          <Button
            onClick={handleContinue}
            disabled={uploadedPhotos.length < requiredPhotos}
            className="rounded-full"
          >
            Далее
            <Icon name="ArrowRight" size={18} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PhotobookPhotoUploader;