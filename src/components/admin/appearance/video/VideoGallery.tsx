import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

export interface BackgroundVideo {
  id: string;
  url: string;
  name: string;
  size: number;
  thumbnail?: string;
}

interface VideoGalleryProps {
  videos: BackgroundVideo[];
  selectedVideoId: string | null;
  onSelectVideo: (videoId: string | null) => void;
  onRemoveVideo: (videoId: string) => void;
}

const VideoGallery = ({
  videos,
  selectedVideoId,
  onSelectVideo,
  onRemoveVideo
}: VideoGalleryProps) => {
  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {videos.map((video) => (
        <div
          key={video.id}
          className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
            selectedVideoId === video.id
              ? 'border-primary ring-2 ring-primary/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
          }`}
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
          
          <div className="p-2 bg-white dark:bg-gray-800 space-y-2">
            <div>
              <p className="text-xs font-medium truncate text-gray-900 dark:text-gray-100">
                {video.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(video.size / 1024 / 1024).toFixed(1)} MB • CDN
              </p>
            </div>
            
            {selectedVideoId !== video.id && (
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectVideo(video.id);
                }}
              >
                <Icon name="CheckCircle" size={14} className="mr-1" />
                Применить
              </Button>
            )}
            
            {selectedVideoId === video.id && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs border-primary text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectVideo(null);
                }}
              >
                <Icon name="Check" size={14} className="mr-1" />
                Активно
              </Button>
            )}
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
        </div>
      ))}
    </div>
  );
};

export default VideoGallery;
