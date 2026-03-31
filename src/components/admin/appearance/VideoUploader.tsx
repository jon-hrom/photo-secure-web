import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import VideoPreviewModal from './video/VideoPreviewModal';
import VideoGallery, { BackgroundVideo } from './video/VideoGallery';
import VideoUploadButton from './video/VideoUploadButton';
import VideoInfoBanner from './video/VideoInfoBanner';

export type { BackgroundVideo };

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
  const API_URL = 'https://functions.poehali.dev/e14599a3-7e42-421d-b200-7e41d0291ad7';

  // Загружаем список видео при монтировании
  useEffect(() => {
    loadVideos();
  }, []);

  // Автоматически выбираем первое видео, если ничего не выбрано
  useEffect(() => {
    if (!selectedVideoId && videos.length > 0 && !isLoadingVideos) {
      const firstVideo = videos[0];
      console.log('[VIDEO_UPLOADER] Auto-selecting first video:', firstVideo.id);
      onSelectVideo(firstVideo.id);
      toast.info('Фоновое видео применено автоматически');
    }
  }, [videos, selectedVideoId, isLoadingVideos, onSelectVideo]);

  const loadVideos = async () => {
    try {
      console.log('[VIDEO_UPLOADER] Loading videos from:', API_URL);
      const response = await fetch(`${API_URL}?type=video`);
      const data = await response.json();
      console.log('[VIDEO_UPLOADER] Videos loaded:', data);
      
      if (data.success && data.files) {
        onVideosChange(data.files);
        console.log('[VIDEO_UPLOADER] Videos set, count:', data.files.length);
      }
    } catch (error) {
      console.error('[VIDEO_UPLOADER] Failed to load videos:', error);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const createThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        // Создаем маленький thumbnail
        const maxWidth = 320;
        const maxHeight = 180;
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
        
        // Берем кадр из середины видео
        video.currentTime = Math.min(1, video.duration / 2);
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, width, height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.6);
          URL.revokeObjectURL(video.src);
          resolve(thumbnail);
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

    // Проверка размера (макс 5MB для стабильной загрузки)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой. Рекомендуем до 5 MB для быстрой загрузки. Сожмите видео или выберите более короткий ролик (5-15 сек).');
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
  };

  const handleConfirmUpload = async (includeMobileVersion = false) => {
    if (!previewFile) return;

    const file = previewFile;

    setIsUploading(true);
    setUploadProgress(0);
    setCompressionInfo('');

    try {
      const fileSize = file.size;
      setCompressionInfo(`Размер: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);
      
      toast.info(includeMobileVersion ? 'Загрузка двух версий видео...' : 'Загрузка в облако...');
      setUploadProgress(10);
      
      // Создаем thumbnail (быстро, без сжатия всего видео)
      const thumbnail = await createThumbnail(file);
      setUploadProgress(includeMobileVersion ? 15 : 30);
      
      // Конвертируем файл в base64 напрямую (БЕЗ сжатия)
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = 30 + (e.loaded / e.total) * 50;
          setUploadProgress(progress);
        }
      };
      
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        try {
          setUploadProgress(85);
          
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
            console.log('[VIDEO_UPLOADER] Upload success, file:', data.file);
            
            // Добавляем thumbnail к файлу
            const newVideo: BackgroundVideo = {
              ...data.file,
              thumbnail
            };
            
            console.log('[VIDEO_UPLOADER] New video object:', newVideo);
            
            const updatedVideos = [...videos, newVideo];
            onVideosChange(updatedVideos);
            
            // Сохраняем URL в localStorage сразу
            localStorage.setItem('loginPageVideoUrl', newVideo.url);
            console.log('[VIDEO_UPLOADER] Saved URL to localStorage:', newVideo.url);
            
            // Если загружаем мобильную версию, сохраняем её отдельно
            if (includeMobileVersion) {
              localStorage.setItem('loginPageMobileVideoUrl', newVideo.url);
              toast.success('Мобильная версия видео загружена!');
            }
            
            // Автоматически выбираем загруженное видео (передаем URL)
            onSelectVideo(newVideo.id);
            
            // Отправляем событие с URL сразу
            const mobileUrl = includeMobileVersion ? newVideo.url : localStorage.getItem('loginPageMobileVideoUrl');
            window.dispatchEvent(new CustomEvent('backgroundVideoChange', { 
              detail: { id: newVideo.id, url: newVideo.url, mobileUrl } 
            }));
            console.log('[VIDEO_UPLOADER] Dispatched event with URL:', newVideo.url, 'mobile:', mobileUrl);
            
            setUploadProgress(100);
            toast.success('Видео загружено и применено как фон!');
            
            setTimeout(() => {
              setIsUploading(false);
              setUploadProgress(0);
              setCompressionInfo('');
              handleCancelPreview();
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
      
      reader.onerror = () => {
        toast.error('Ошибка чтения файла');
        setIsUploading(false);
        setUploadProgress(0);
        setCompressionInfo('');
      };
      
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Video upload error:', error);
      toast.error('Ошибка при загрузке видео');
      setIsUploading(false);
      setUploadProgress(0);
      setCompressionInfo('');
    }
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

  console.log('[VIDEO_UPLOADER] Render - videos:', videos.length, 'selectedVideoId:', selectedVideoId);

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
      {previewVideo && previewFile && (
        <VideoPreviewModal
          previewVideo={previewVideo}
          previewFile={previewFile}
          isUploading={isUploading}
          onCancel={handleCancelPreview}
          onConfirm={(isMobile) => handleConfirmUpload(isMobile || false)}
        />
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Фоновое видео
        </Label>
        <p className="text-xs text-muted-foreground">
          Загрузите видео для анимированного фона. Рекомендуется использовать оптимизированные видео до 10 МБ.
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          📱 Совет: загрузите отдельную сжатую версию для мобильных (720p) — кнопка появится при загрузке
        </p>
        {videos.length > 0 && !selectedVideoId && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            💡 Кликните на видео ниже, чтобы установить его как фон
          </p>
        )}
      </div>

      {videos.length > 0 && (
        <VideoGallery
          videos={videos}
          selectedVideoId={selectedVideoId}
          onSelectVideo={onSelectVideo}
          onRemoveVideo={handleRemoveVideo}
        />
      )}

      <VideoUploadButton
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        compressionInfo={compressionInfo}
        onFileSelect={handleFileSelect}
      />

      <VideoInfoBanner />
    </div>
  );
};

export default VideoUploader;