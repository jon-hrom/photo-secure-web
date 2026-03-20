import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import funcUrls from '@/../backend/func2url.json';
import { useRetouch } from '@/contexts/RetouchContext';
import RetouchWakeStatus from './RetouchWakeStatus';
import RetouchTaskList from './RetouchTaskList';
import RetouchPhotoSelector from './RetouchPhotoSelector';

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
    if (!newOpen && isProcessing) {
      setMinimized(true);
      onOpenChange(false);
      return;
    }
    if (!newOpen) {
      handleClose();
    }
  };

  const handleClose = () => {
    setPhotos([]);
    setSelectedPhotoId(null);
    setActiveTab('single');
    if (!isProcessing && tasks.length === 0) {
      fullClose();
    }
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
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-rose-50/80 via-pink-50/60 to-purple-50/80 dark:from-rose-950/80 dark:via-pink-950/60 dark:to-purple-950/80 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Sparkles" size={20} className="text-rose-600" />
            Ретушь фото
          </DialogTitle>
          <DialogDescription>
            Папка: {folderName}
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
};

export default RetouchDialog;