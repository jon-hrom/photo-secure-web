import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import func2url from '../../../backend/func2url.json';
import VideoUrlInput from './video-upload/VideoUrlInput';
import VideoPreviewCard from './video-upload/VideoPreviewCard';
import VideoUploadProgress from './video-upload/VideoUploadProgress';

interface VideoUrlUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  folderId?: number | null;
  onSuccess?: () => void;
}

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

interface UploadStage {
  label: string;
  icon: string;
  progressRange: [number, number];
}

const UPLOAD_STAGES: UploadStage[] = [
  { label: 'Скачиваю с источника...', icon: 'Download', progressRange: [0, 55] },
  { label: 'Обрабатываю файл...', icon: 'Cog', progressRange: [55, 75] },
  { label: 'Загружаю в хранилище...', icon: 'CloudUpload', progressRange: [75, 92] },
  { label: 'Сохраняю в фотобанк...', icon: 'Database', progressRange: [92, 98] },
];

function estimateDurationSec(filesize: number): number {
  if (!filesize || filesize <= 0) return 60;
  const mb = filesize / 1048576;
  if (mb < 10) return 15;
  if (mb < 50) return 30;
  if (mb < 100) return 60;
  if (mb < 300) return 120;
  return 180;
}

export default function VideoUrlUploadDialog({
  open,
  onOpenChange,
  userId,
  folderId,
  onSuccess
}: VideoUrlUploadDialogProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedQuality, setSelectedQuality] = useState('');
  const [audioOnly, setAudioOnly] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef(0);
  const estimatedDurRef = useRef(60);
  const { toast } = useToast();

  const stopProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressTimer = useCallback((filesize: number) => {
    stopProgressTimer();
    const dur = estimateDurationSec(filesize);
    estimatedDurRef.current = dur;
    startTimeRef.current = Date.now();
    setProgress(0);
    setCurrentStageIdx(0);
    setUploadDone(false);

    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const ratio = Math.min(elapsed / estimatedDurRef.current, 1);
      const eased = 1 - Math.pow(1 - ratio, 2.5);
      const pct = Math.min(eased * 96, 96);

      setProgress(pct);

      const stageIdx = UPLOAD_STAGES.findIndex(
        (s) => pct >= s.progressRange[0] && pct < s.progressRange[1]
      );
      if (stageIdx >= 0) setCurrentStageIdx(stageIdx);
      else if (pct >= 92) setCurrentStageIdx(3);
    }, 200);
  }, [stopProgressTimer]);

  const finishProgress = useCallback(() => {
    stopProgressTimer();
    setProgress(100);
    setCurrentStageIdx(-1);
    setUploadDone(true);
    setTimeout(() => setUploadDone(false), 2000);
  }, [stopProgressTimer]);

  useEffect(() => {
    return () => stopProgressTimer();
  }, [stopProgressTimer]);

  const handleExtract = async () => {
    if (!url.trim()) {
      setError('Вставьте ссылку на видео');
      return;
    }

    setExtracting(true);
    setError('');
    setVideoInfo(null);

    try {
      const response = await fetch(func2url['video-url-upload'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ url: url.trim(), mode: 'extract', audio_only: audioOnly })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось получить информацию о видео');
      }

      setVideoInfo(data);
      if (data.qualities?.length) {
        const best = data.qualities[data.qualities.length - 1];
        setSelectedQuality(best.format_id);
      } else {
        setSelectedQuality('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setError(msg);
    } finally {
      setExtracting(false);
    }
  };

  const handleDownloadToDevice = () => {
    if (!videoInfo?.download_url) return;

    const a = document.createElement('a');
    a.href = videoInfo.download_url;
    a.download = `${videoInfo.title || 'video'}.${audioOnly ? 'mp3' : (videoInfo.ext || 'mp4')}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: 'Скачивание начато',
      description: audioOnly ? 'Аудио загружается на ваше устройство' : 'Видео загружается на ваше устройство'
    });
  };

  const handleUploadToS3 = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    const selQ = videoInfo?.qualities?.find(q => q.format_id === selectedQuality);
    startProgressTimer(selQ?.filesize || videoInfo?.filesize || 0);

    try {
      const response = await fetch(func2url['video-url-upload'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          url: url.trim(),
          folder_id: folderId,
          mode: 'upload',
          format_id: audioOnly ? undefined : (selectedQuality || undefined),
          audio_only: audioOnly
        }),
        signal: controller.signal
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки видео');
      }

      finishProgress();

      toast({
        title: audioOnly ? 'Аудио загружено в фотобанк!' : 'Видео загружено в фотобанк!',
        description: `Файл: ${data.filename}`,
        duration: 4000
      });

      setTimeout(() => {
        resetState();
        onOpenChange(false);
        onSuccess?.();
      }, 1200);
    } catch (err) {
      stopProgressTimer();
      setProgress(0);
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast({ title: 'Загрузка отменена' });
      } else {
        const msg = err instanceof Error ? err.message : 'Не удалось загрузить видео';
        setError(msg);
        toast({ variant: 'destructive', title: 'Ошибка', description: msg });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    stopProgressTimer();
    setProgress(0);
    setLoading(false);
  };

  const resetState = () => {
    setUrl('');
    setError('');
    setVideoInfo(null);
    setSelectedQuality('');
    setAudioOnly(false);
    setProgress(0);
    setCurrentStageIdx(0);
    setUploadDone(false);
    stopProgressTimer();
  };

  const handleClose = () => {
    if (!loading && !extracting) {
      resetState();
      onOpenChange(false);
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (videoInfo) setVideoInfo(null);
    if (error) setError('');
  };

  const formatDuration = (sec: number) => {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} ГБ`;
    return `${(bytes / 1048576).toFixed(1)} МБ`;
  };

  const isProcessing = loading || extracting;
  const currentStage = UPLOAD_STAGES[currentStageIdx] || null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[560px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="Video" size={20} className="text-blue-600" />
            Скачать видео по ссылке
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Вставьте ссылку — видео скачается автоматически без установки программ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <VideoUrlInput
            url={url}
            onUrlChange={handleUrlChange}
            onExtract={handleExtract}
            extracting={extracting}
            disabled={isProcessing}
            showSources={!videoInfo && !error}
          />

          {error && (
            <Alert variant="destructive">
              <Icon name="AlertCircle" size={14} />
              <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {videoInfo && (
            <>
              <VideoPreviewCard
                videoInfo={videoInfo}
                selectedQuality={selectedQuality}
                onSelectQuality={setSelectedQuality}
                audioOnly={audioOnly}
                onSetAudioOnly={setAudioOnly}
                loading={loading}
                uploadDone={uploadDone}
                isProcessing={isProcessing}
                onDownloadToDevice={handleDownloadToDevice}
                onUploadToS3={handleUploadToS3}
                formatDuration={formatDuration}
                formatSize={formatSize}
              />

              <VideoUploadProgress
                loading={loading}
                uploadDone={uploadDone}
                progress={progress}
                currentStage={currentStage}
                onCancel={handleCancel}
                filesize={videoInfo.filesize}
                estimatedDuration={estimatedDurRef.current}
                formatSize={formatSize}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
