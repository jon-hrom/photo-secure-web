import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

export interface BackgroundVideo {
  id: string;
  url: string;
  name: string;
  size: number;
  thumbnail?: string;
}

interface VideoUploaderProps {
  videos: BackgroundVideo[];
  selectedVideoId: string | null;
  onVideosChange: (videos: BackgroundVideo[]) => void;
  onSelectVideo: (videoId: string | null) => void;
  onRemoveVideo: (videoId: string) => void;
}

const VideoUploader = ({
  videos,
  selectedVideoId,
  onVideosChange,
  onSelectVideo,
  onRemoveVideo
}: VideoUploaderProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressionInfo, setCompressionInfo] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressVideo = async (file: File): Promise<{ blob: Blob; thumbnail: string }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        // Уменьшаем разрешение для быстрой загрузки
        const maxWidth = 1920;
        const maxHeight = 1080;
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Создаем thumbnail
        video.currentTime = 1;
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, width, height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          
          // Сжимаем видео через canvas
          const chunks: Blob[] = [];
          const stream = canvas.captureStream(30); // 30 FPS
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 2500000 // 2.5 Mbps для хорошего качества
          });
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
              setUploadProgress(Math.min(90, (chunks.length / 100) * 100));
            }
          };
          
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            URL.revokeObjectURL(video.src);
            resolve({ blob, thumbnail });
          };
          
          mediaRecorder.onerror = (e) => {
            URL.revokeObjectURL(video.src);
            reject(e);
          };
          
          // Начинаем запись
          mediaRecorder.start(100);
          
          // Перематываем и рисуем каждый кадр
          video.currentTime = 0;
          video.play();
          
          const drawFrame = () => {
            if (video.ended || video.paused) {
              mediaRecorder.stop();
              return;
            }
            ctx.drawImage(video, 0, 0, width, height);
            requestAnimationFrame(drawFrame);
          };
          
          video.onended = () => {
            setTimeout(() => mediaRecorder.stop(), 100);
          };
          
          requestAnimationFrame(drawFrame);
        };
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video'));
      };
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    if (!file.type.startsWith('video/')) {
      toast.error('Выберите видео файл');
      return;
    }

    // Проверка размера (макс 100MB оригинал)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Файл слишком большой. Максимум 100MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setCompressionInfo('');

    try {
      const originalSize = file.size;
      setCompressionInfo(`Оригинал: ${(originalSize / 1024 / 1024).toFixed(1)} MB`);
      
      toast.info('Оптимизация видео...');
      const { blob, thumbnail } = await compressVideo(file);
      
      const optimizedSize = blob.size;
      const saved = ((1 - optimizedSize / originalSize) * 100).toFixed(0);
      
      setCompressionInfo(
        `Оригинал: ${(originalSize / 1024 / 1024).toFixed(1)} MB → ` +
        `Оптимизировано: ${(optimizedSize / 1024 / 1024).toFixed(1)} MB (сжато на ${saved}%)`
      );
      
      // Конвертируем в base64 для сохранения в localStorage
      const reader = new FileReader();
      reader.onload = () => {
        const videoUrl = reader.result as string;
        
        const newVideo: BackgroundVideo = {
          id: `video-${Date.now()}`,
          url: videoUrl,
          name: file.name,
          size: optimizedSize,
          thumbnail
        };
        
        const updatedVideos = [...videos, newVideo];
        onVideosChange(updatedVideos);
        
        setUploadProgress(100);
        toast.success('Видео загружено и оптимизировано!');
        
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          setCompressionInfo('');
        }, 2000);
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      console.error('Video compression error:', error);
      toast.error('Ошибка при обработке видео');
      setIsUploading(false);
      setUploadProgress(0);
      setCompressionInfo('');
    }

    // Сбрасываем input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Фоновое видео
        </Label>
        <p className="text-xs text-muted-foreground">
          Загрузите видео для анимированного фона страницы входа. Видео будет автоматически оптимизировано.
        </p>
      </div>

      {videos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {videos.map((video) => (
            <div
              key={video.id}
              className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                selectedVideoId === video.id
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
              }`}
              onClick={() => onSelectVideo(selectedVideoId === video.id ? null : video.id)}
            >
              {video.thumbnail ? (
                <div className="relative aspect-video">
                  <img
                    src={video.thumbnail}
                    alt={video.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Icon name="Play" size={32} className="text-white" />
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Icon name="Video" size={32} className="text-gray-400" />
                </div>
              )}
              
              <div className="p-2 bg-white dark:bg-gray-800">
                <p className="text-xs font-medium truncate text-gray-900 dark:text-gray-100">
                  {video.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(video.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>

              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveVideo(video.id);
                }}
              >
                <Icon name="X" size={14} />
              </Button>

              {selectedVideoId === video.id && (
                <div className="absolute top-2 left-2 bg-primary text-white px-2 py-1 rounded text-xs font-medium">
                  Активно
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
              Обработка...
            </>
          ) : (
            <>
              <Icon name="Video" size={16} className="mr-2" />
              Загрузить видео
            </>
          )}
        </Button>

        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            {compressionInfo && (
              <p className="text-xs text-muted-foreground text-center">
                {compressionInfo}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex gap-2">
          <Icon name="Info" size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-blue-900 dark:text-blue-300">
            <p className="font-medium">Рекомендации по видео:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-400">
              <li>Длительность: 10-30 секунд (будет зациклено)</li>
              <li>Формат: любой (MP4, MOV, AVI и т.д.)</li>
              <li>Размер: до 100MB (будет автоматически сжато)</li>
              <li>Разрешение: будет оптимизировано до Full HD</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoUploader;
