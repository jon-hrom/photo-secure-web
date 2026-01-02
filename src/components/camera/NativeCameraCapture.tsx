import { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

interface NativeCameraCaptureProps {
  onCapture: (imageData: string, fileName: string) => Promise<void>;
  userId: string;
  folderId?: string;
}

const NativeCameraCapture = ({ onCapture, userId, folderId }: NativeCameraCaptureProps) => {
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const capturePhoto = async () => {
    try {
      setCapturing(true);
      
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (image.base64String) {
        const fileName = `photo_${Date.now()}.${image.format}`;
        await uploadToS3(image.base64String, fileName, `image/${image.format}`);
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        toast({
          title: 'Ошибка съёмки',
          description: error.message,
          variant: 'destructive'
        });
      }
    } finally {
      setCapturing(false);
    }
  };

  const selectFromGallery = async () => {
    try {
      setCapturing(true);
      
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });

      if (image.base64String) {
        const fileName = `photo_${Date.now()}.${image.format}`;
        await uploadToS3(image.base64String, fileName, `image/${image.format}`);
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        toast({
          title: 'Ошибка выбора фото',
          description: error.message,
          variant: 'destructive'
        });
      }
    } finally {
      setCapturing(false);
    }
  };

  const recordVideo = () => {
    videoInputRef.current?.click();
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setRecording(true);
      
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (base64) {
          const fileName = `video_${Date.now()}.mp4`;
          await uploadToS3(base64, fileName, 'video/mp4');
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast({
        title: 'Ошибка видео',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setRecording(false);
    }
  };

  const uploadToS3 = async (base64Data: string, fileName: string, fileType: string) => {
    try {
      setUploading(true);
      
      const response = await fetch('https://functions.poehali.dev/324ca8fc-3f85-427e-9bf0-bfe57b31e540', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          file: base64Data,
          file_name: fileName,
          file_type: fileType,
          folder_id: folderId || 'default'
        })
      });

      const result = await response.json();

      if (result.success) {
        const isVideo = fileType.startsWith('video/');
        toast({
          title: 'Успешно!',
          description: isVideo ? 'Видео загружено на сервер' : 'Фото загружено на сервер'
        });
        await onCapture(result.cdn_url, fileName);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Камера</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={capturePhoto}
            disabled={capturing || uploading || recording}
            size="lg"
            className="h-24 flex flex-col gap-2"
          >
            <Icon name="Camera" size={32} />
            <span>Снять фото</span>
          </Button>

          <Button
            onClick={selectFromGallery}
            disabled={capturing || uploading || recording}
            size="lg"
            variant="secondary"
            className="h-24 flex flex-col gap-2"
          >
            <Icon name="Images" size={32} />
            <span>Из галереи</span>
          </Button>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <Button
            onClick={recordVideo}
            disabled={capturing || uploading || recording}
            size="lg"
            variant="outline"
            className="h-24 flex flex-col gap-2"
          >
            <Icon name="Video" size={32} />
            <span>Снять видео</span>
          </Button>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleVideoSelect}
            className="hidden"
          />
        </div>

        {(capturing || uploading || recording) && (
          <div className="text-center text-sm text-muted-foreground">
            {capturing ? 'Открываю камеру...' : recording ? 'Обработка видео...' : 'Загружаю на сервер...'}
          </div>
        )}
      </div>
    </Card>
  );
};

export default NativeCameraCapture;