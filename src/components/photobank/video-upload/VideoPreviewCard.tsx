import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface VideoQuality {
  format_id: string;
  height: number;
  ext: string;
  filesize: number;
  label: string;
  has_audio: boolean;
}

interface AudioInfo {
  available: boolean;
  format_id: string;
  ext: string;
  filesize: number;
  abr: number;
  label: string;
}

interface VideoInfo {
  title: string;
  download_url: string;
  thumbnail: string;
  duration: number;
  filesize: number;
  ext: string;
  qualities?: VideoQuality[];
  audio?: AudioInfo;
}

interface VideoPreviewCardProps {
  videoInfo: VideoInfo;
  selectedQuality: string;
  onSelectQuality: (formatId: string) => void;
  audioOnly: boolean;
  onSetAudioOnly: (value: boolean) => void;
  loading: boolean;
  uploadDone: boolean;
  isProcessing: boolean;
  onDownloadToDevice: () => void;
  onUploadToS3: () => void;
  formatDuration: (sec: number) => string;
  formatSize: (bytes: number) => string;
}

export default function VideoPreviewCard({
  videoInfo,
  selectedQuality,
  onSelectQuality,
  audioOnly,
  onSetAudioOnly,
  loading,
  uploadDone,
  isProcessing,
  onDownloadToDevice,
  onUploadToS3,
  formatDuration,
  formatSize
}: VideoPreviewCardProps) {
  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      <div className="flex gap-3">
        {videoInfo.thumbnail && (
          <img
            src={videoInfo.thumbnail}
            alt=""
            className="w-24 h-16 sm:w-32 sm:h-20 object-cover rounded flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{videoInfo.title || 'Видео'}</p>
          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
            {videoInfo.duration > 0 && (
              <span className="flex items-center gap-1">
                <Icon name="Clock" size={12} />
                {formatDuration(videoInfo.duration)}
              </span>
            )}
            {videoInfo.filesize > 0 && (
              <span className="flex items-center gap-1">
                <Icon name="HardDrive" size={12} />
                {formatSize(videoInfo.filesize)}
              </span>
            )}
          </div>
        </div>
      </div>

      {videoInfo.audio?.available && !loading && !uploadDone && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetAudioOnly(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
              !audioOnly
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-background hover:bg-muted border-border text-foreground'
            }`}
          >
            <Icon name="Video" size={14} />
            Видео
          </button>
          <button
            onClick={() => onSetAudioOnly(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
              audioOnly
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-background hover:bg-muted border-border text-foreground'
            }`}
          >
            <Icon name="Music" size={14} />
            Аудио MP3
          </button>
          {audioOnly && videoInfo.audio && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {videoInfo.audio.label}
            </span>
          )}
        </div>
      )}

      {!audioOnly && videoInfo.qualities && videoInfo.qualities.length > 1 && !loading && !uploadDone && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Качество:</p>
          <div className="flex flex-wrap gap-1.5">
            {videoInfo.qualities.map((q) => (
              <button
                key={q.format_id}
                onClick={() => onSelectQuality(q.format_id)}
                className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                  selectedQuality === q.format_id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-background hover:bg-muted border-border text-foreground'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && !uploadDone && (
        <div className={`grid gap-2 ${audioOnly ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {!audioOnly && (
            <Button
              onClick={onDownloadToDevice}
              variant="outline"
              className="w-full"
              disabled={isProcessing}
            >
              <Icon name="Download" size={16} className="mr-2" />
              Скачать на устройство
            </Button>
          )}
          <Button
            onClick={onUploadToS3}
            className="w-full"
            disabled={isProcessing}
          >
            <Icon name={audioOnly ? 'Music' : 'CloudUpload'} size={16} className="mr-2" />
            {audioOnly ? 'Извлечь MP3 в фотобанк' : 'В фотобанк'}
          </Button>
        </div>
      )}
    </div>
  );
}
