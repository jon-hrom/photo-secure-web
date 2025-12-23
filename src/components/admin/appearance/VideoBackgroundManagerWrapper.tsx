import { toast as sonnerToast } from 'sonner';
import VideoUploader, { BackgroundVideo } from './VideoUploader';

interface VideoBackgroundManagerWrapperProps {
  backgroundVideos: BackgroundVideo[];
  setBackgroundVideos: (videos: BackgroundVideo[]) => void;
  selectedVideoId: string | null;
  setSelectedVideoId: (id: string | null) => void;
  setSelectedBackgroundId: (id: string | null) => void;
}

const VideoBackgroundManagerWrapper = ({
  backgroundVideos,
  setBackgroundVideos,
  selectedVideoId,
  setSelectedVideoId,
  setSelectedBackgroundId,
}: VideoBackgroundManagerWrapperProps) => {
  const handleVideosChange = (videos: BackgroundVideo[]) => {
    setBackgroundVideos(videos);
  };

  const handleSelectVideo = (videoId: string | null) => {
    setSelectedVideoId(videoId);
    if (videoId) {
      const selectedVideo = backgroundVideos.find(v => v.id === videoId);
      localStorage.setItem('loginPageVideo', videoId);
      
      if (selectedVideo) {
        localStorage.setItem('loginPageVideoUrl', selectedVideo.url);
        const mobileUrl = localStorage.getItem('loginPageMobileVideoUrl');
        window.dispatchEvent(new CustomEvent('backgroundVideoChange', { 
          detail: { id: videoId, url: selectedVideo.url, mobileUrl } 
        }));
      } else {
        window.dispatchEvent(new CustomEvent('backgroundVideoChange', { detail: { id: videoId } }));
      }
      
      setSelectedBackgroundId(null);
      localStorage.removeItem('loginPageBackground');
      sonnerToast.success('Фоновое видео применено');
    } else {
      localStorage.removeItem('loginPageVideo');
      localStorage.removeItem('loginPageVideoUrl');
      window.dispatchEvent(new CustomEvent('backgroundVideoChange', { detail: null }));
      sonnerToast.info('Фоновое видео отключено');
    }
  };

  const handleRemoveVideo = (videoId: string) => {
    const updatedVideos = backgroundVideos.filter(v => v.id !== videoId);
    setBackgroundVideos(updatedVideos);
    
    if (selectedVideoId === videoId) {
      setSelectedVideoId(null);
      localStorage.removeItem('loginPageVideo');
      localStorage.removeItem('loginPageVideoUrl');
      window.dispatchEvent(new CustomEvent('backgroundVideoChange', { detail: null }));
    }
  };

  return (
    <VideoUploader
      videos={backgroundVideos}
      selectedVideoId={selectedVideoId}
      onVideosChange={handleVideosChange}
      onSelectVideo={handleSelectVideo}
      onRemoveVideo={handleRemoveVideo}
    />
  );
};

export default VideoBackgroundManagerWrapper;
