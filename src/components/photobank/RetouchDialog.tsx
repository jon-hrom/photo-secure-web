import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import funcUrls from '@/../backend/func2url.json';
import { useRetouch } from '@/contexts/RetouchContext';
import RetouchWakeStatus from './RetouchWakeStatus';
import RetouchTaskList from './RetouchTaskList';
import RetouchPhotoSelector from './RetouchPhotoSelector';
import RetouchSettings from './RetouchSettings';

const PHOTOBANK_FOLDERS_API = funcUrls['photobank-folders'];

interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  data_url?: string;
}

interface RetouchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: number;
  folderName: string;
  userId: string;
  onRetouchComplete?: () => void;
}

const RetouchDialog = ({ open, onOpenChange, folderId, folderName, userId, onRetouchComplete }: RetouchDialogProps) => {
  const {
    tasks, isProcessing, waking, wakeStatus, submitting, minimized,
    startSession, fullClose, handleRetouchSingle, handleRetouchAll,
    retryTask, retryAllFailed, setMinimized, session
  } = useRetouch();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('single');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const hasActiveWorkRef = useRef(false);

  useEffect(() => {
    hasActiveWorkRef.current = isProcessing || tasks.length > 0 || minimized;
  }, [isProcessing, tasks, minimized]);

  useEffect(() => {
    if (open && folderId) {
      startSession({ folderId, folderName, userId, onRetouchComplete });
      loadPhotos();
    }
  }, [open, folderId]);

  const loadPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const url = `${PHOTOBANK_FOLDERS_API}?action=list_photos&folder_id=${folderId}`;
      const res = await fetch(url, {
        headers: { 'X-User-Id': userId }
      });
      if (!res.ok) throw new Error('Failed to load photos');
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (error) {
      console.error('[RETOUCH] Failed to load photos:', error);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (isProcessing) {
        setShowConfirm(true);
        return;
      }
      if (hasActiveWorkRef.current) {
        setMinimized(true);
      } else {
        fullClose();
      }
      onOpenChange(false);
    }
  };

  const handleConfirmStop = () => {
    setShowConfirm(false);
    fullClose();
    onOpenChange(false);
  };

  const handleConfirmMinimize = () => {
    setShowConfirm(false);
    setMinimized(true);
    onOpenChange(false);
  };

  const onRetouchSingle = async () => {
    if (!selectedPhotoId) return;
    await handleRetouchSingle(selectedPhotoId, photos);
  };

  const onRetouchAll = async () => {
    await handleRetouchAll(photos);
  };

  const hasTasks = tasks.length > 0 && session?.folderId === folderId;

  if (minimized) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className={`${showSettings ? 'max-w-5xl' : 'max-w-2xl'} w-[calc(100%-1rem)] sm:w-full max-h-[92vh] sm:max-h-[85vh] overflow-y-auto bg-gradient-to-br from-rose-50/80 via-pink-50/60 to-purple-50/80 dark:from-rose-950/80 dark:via-pink-950/60 dark:to-purple-950/80 backdrop-blur-sm rounded-2xl sm:rounded-xl p-4 sm:p-6 transition-all duration-300`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="Sparkles" size={18} className="text-rose-600" />
            Ретушь фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Папка: {folderName}
          </DialogDescription>
        </DialogHeader>

        {showSettings ? (
          <RetouchSettings
            userId={userId}
            onBack={() => setShowSettings(false)}
            previewPhoto={photos.find(p => p.id === selectedPhotoId) || photos[0] || null}
            photos={photos}
          />
        ) : (
          <>
            {!hasTasks && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit text-xs text-muted-foreground hover:text-foreground -mt-1"
                onClick={() => setShowSettings(true)}
              >
                <Icon name="SlidersHorizontal" size={14} className="mr-1" />
                Настройки ретуши
              </Button>
            )}

            <RetouchWakeStatus waking={waking} wakeStatus={wakeStatus} />

            {hasTasks && (
              <RetouchTaskList
                tasks={tasks}
                onRetryTask={retryTask}
                onRetryAllFailed={retryAllFailed}
              />
            )}

            {!hasTasks && (
              <RetouchPhotoSelector
                photos={photos}
                loadingPhotos={loadingPhotos}
                selectedPhotoId={selectedPhotoId}
                onSelectPhoto={setSelectedPhotoId}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                submitting={submitting}
                waking={waking}
                onRetouchSingle={onRetouchSingle}
                onRetouchAll={onRetouchAll}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm rounded-2xl sm:rounded-xl p-5 sm:p-6">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Icon name="AlertTriangle" size={24} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1.5">
            <DialogHeader className="p-0">
              <DialogTitle className="font-semibold text-base sm:text-lg text-foreground">Остановить обработку?</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1.5">
                Оставшиеся фото не будут обработаны. Все фотографии, которые уже прошли ретушь, сохранены и доступны в вашей папке.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full mt-1">
            <Button
              variant="outline"
              onClick={handleConfirmMinimize}
              className="h-11 sm:h-10 text-sm flex-1"
            >
              Свернуть
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmStop}
              className="h-11 sm:h-10 text-sm flex-1"
            >
              Остановить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default RetouchDialog;