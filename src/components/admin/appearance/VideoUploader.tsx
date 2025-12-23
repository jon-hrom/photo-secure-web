import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import funcUrls from '../../../../backend/func2url.json';

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
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const API_URL = funcUrls['background-media'];

  // Загружаем список видео при монтировании
  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const response = await fetch(`${API_URL}?type=video`);
      const data = await response.json();
      
      if (data.success && data.files) {
        onVideosChange(data.files);
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const compressVideo = async (file: File): Promise<{ blob: Blob; thumbnail: string }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        // Уменьшаем разрешение до 720p для быстрой загрузки
        const maxWidth = 1280;
        const maxHeight = 720;
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
        video.currentTime = Math.min(1, video.duration / 2);
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, width, height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          
          // Сжимаем видео
          const chunks: Blob[] = [];
          const stream = canvas.captureStream(25); // 25 FPS для меньшего размера
          
          let mimeType = 'video/webm;codecs=vp8'; // VP8 быстрее VP9
          const videoBitsPerSecond = 1500000; // 1.5 Mbps - баланс качество/размер
          
          // Проверяем поддержку кодеков
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
          }
          
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond
          });
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
              const progress = Math.min(90, (video.currentTime / video.duration) * 100);
              setUploadProgress(progress);
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

    // Проверка размера (макс 50MB оригинал)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Файл слишком большой. Максимум 50MB');
      return;
    }

    // Показываем предпросмотр
    const videoUrl = URL.createObjectURL(file);
    setPreviewVideo(videoUrl);
    setPreviewFile(file);
  };

  const handleCancelPreview = () => {
    if (previewVideo) {
      URL.revokeObjectURL(previewVideo);
    }
    setPreviewVideo(null);
    setPreviewFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewFile) return;

    const file = previewFile;

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
        `Оптимизировано: ${(optimizedSize / 1024 / 1024).toFixed(1)} MB (сжато на ${saved}%)`
      );
      
      setUploadProgress(92);
      toast.info('Загрузка в облако...');
      
      // Конвертируем в base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        try {
          // Загружаем в S3
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file: base64Data,
              filename: file.name,
              type: 'video'
            })
          });
          
          const data = await response.json();
          
          if (data.success && data.file) {
            // Добавляем thumbnail к файлу
            const newVideo: BackgroundVideo = {
              ...data.file,
              thumbnail
            };
            
            const updatedVideos = [...videos, newVideo];
            onVideosChange(updatedVideos);
            
            setUploadProgress(100);
            toast.success('Видео загружено! Теперь оно загружается молниеносно через CDN');
            
            setTimeout(() => {
              setIsUploading(false);
              setUploadProgress(0);
              setCompressionInfo('');
            }, 2000);
          } else {
            throw new Error(data.error || 'Upload failed');
          }
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('Ошибка загрузки в облако');
          setIsUploading(false);
          setUploadProgress(0);
          setCompressionInfo('');
        }
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      console.error('Video compression error:', error);
      toast.error('Ошибка при обработке видео');
      setIsUploading(false);
      setUploadProgress(0);
      setCompressionInfo('');
    }

    // Сбрасываем input и превью
    handleCancelPreview();
  };

  const handleRemoveVideo = async (videoId: string) => {
    try {
      const response = await fetch(API_URL, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileId: videoId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        onRemoveVideo(videoId);
        toast.success('Видео удалено');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Ошибка удаления');
    }
  };

  if (isLoadingVideos) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="Loader2" className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Превью видео перед загрузкой */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Предпросмотр видео</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelPreview}
              >
                <Icon name="X" size={20} />
              </Button>
            </div>
            
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={previewVideoRef}
                src={previewVideo}
                controls
                autoPlay
                loop
                className="w-full h-full object-contain"
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>Размер: {previewFile && (previewFile.size / 1024 / 1024).toFixed(1)} MB</p>
              <p className="mt-1">Видео будет оптимизировано до 720p (1280×720) для быстрой загрузки</p>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={handleCancelPreview}
              >
                Отмена
              </Button>
              <Button
                onClick={handleConfirmUpload}
                disabled={isUploading}
              >
                {isUploading ? 'Загрузка...' : 'Загрузить видео'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Фоновое видео
        </Label>
        <p className="text-xs text-muted-foreground">
          Загрузите видео для анимированного фона. Видео будет оптимизировано и загружено в CDN для молниеносной загрузки.
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
                  {(video.size / 1024 / 1024).toFixed(1)} MB • CDN
                </p>
              </div>

              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveVideo(video.id);
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
              <Icon name="Upload" size={16} className="mr-2" />
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
          <Icon name="Zap" size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-blue-900 dark:text-blue-300">
            <p className="font-medium">Молниеносная загрузка через CDN:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-400">
              <li>Видео сжимается до 720p с битрейтом 1.5 Mbps</li>
              <li>Загружается в облачное хранилище Yandex Cloud</li>
              <li>Раздается через CDN для мгновенной загрузки</li>
              <li>Рекомендуем: 10-30 секунд (будет зациклено)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoUploader;