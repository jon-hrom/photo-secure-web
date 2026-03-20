import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import funcUrls from '@/../backend/func2url.json';
import RetouchWakeStatus from './RetouchWakeStatus';
import RetouchTaskList, { type RetouchTask } from './RetouchTaskList';
import RetouchPhotoSelector from './RetouchPhotoSelector';

const RETOUCH_API = funcUrls['retouch'];
const RETOUCH_WAKER_API = funcUrls['retouch-waker'];
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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<RetouchTask[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [waking, setWaking] = useState(false);
  const [wakeStatus, setWakeStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('single');
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retouchCompleteCalledRef = useRef(false);

  useEffect(() => {
    if (open && folderId) {
      loadPhotos();
    }
    if (!open) {
      setPhotos([]);
      setSelectedPhotoId(null);
      setTasks([]);
      setSubmitting(false);
      setWaking(false);
      setWakeStatus(null);
      setActiveTab('single');
      stopPolling();
      retouchCompleteCalledRef.current = false;
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

  const wakeRetouchServer = async (): Promise<boolean> => {
    setWaking(true);
    setWakeStatus('waking');
    console.log('[RETOUCH] Waking retouch server...');
    try {
      const res = await fetch(`${RETOUCH_WAKER_API}?action=wake`, { method: 'POST' });
      if (!res.ok) {
        setWakeStatus('Не удалось запустить сервис. Попробуйте позже');
        setWaking(false);
        return false;
      }
      const data = await res.json();
      console.log('[RETOUCH] Wake response:', data);

      if (data.action === 'already_running') {
        setWakeStatus('готов');
        setWaking(false);
        return true;
      }

      if (data.action === 'starting' || data.action === 'already_starting') {
        const maxWait = 90;
        const interval = 5;
        for (let elapsed = 0; elapsed < maxWait; elapsed += interval) {
          await new Promise(r => setTimeout(r, interval * 1000));
          try {
            const probe = await fetch(`${RETOUCH_WAKER_API}?probe=1`, { signal: AbortSignal.timeout(8000) });
            if (probe.ok) {
              const probeData = await probe.json();
              if (probeData.probe?.reachable) {
                setWakeStatus('готов');
                setWaking(false);
                return true;
              }
            }
          } catch { /* still starting */ }
        }
        setWakeStatus('Сервис не успел запуститься. Попробуйте через пару минут');
        setWaking(false);
        return false;
      }

      setWakeStatus(null);
      setWaking(false);
      return true;
    } catch (error) {
      console.error('[RETOUCH] Wake failed:', error);
      setWakeStatus('Ошибка при запуске сервиса');
      setWaking(false);
      return false;
    }
  };

  const ensureServerReady = async (): Promise<boolean> => {
    try {
      const probe = await fetch(`${RETOUCH_WAKER_API}?probe=1`, { signal: AbortSignal.timeout(8000) });
      if (probe.ok) {
        const data = await probe.json();
        if (data.probe?.reachable) return true;
      }
    } catch { /* server not reachable */ }
    return await wakeRetouchServer();
  };

  const startRetouchForPhoto = async (photoId: number, isRetryAfterWake = false): Promise<RetouchTask | null> => {
    try {
      const res = await fetch(RETOUCH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ photo_id: photoId })
      });
      if ((res.status === 502 || res.status === 504) && !isRetryAfterWake) {
        console.log(`[RETOUCH] Got ${res.status}, attempting to wake server...`);
        const woken = await wakeRetouchServer();
        if (woken) {
          return startRetouchForPhoto(photoId, true);
        }
      }
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      const photo = photos.find(p => p.id === photoId);
      return {
        photo_id: photoId,
        task_id: data.task_id,
        status: data.status || 'queued',
        file_name: photo?.file_name
      };
    } catch (error) {
      console.error('[RETOUCH] Failed to start retouch for photo', photoId, error);
      const photo = photos.find(p => p.id === photoId);
      return {
        photo_id: photoId,
        task_id: '',
        status: 'failed',
        error_message: 'Не удалось запустить ретушь',
        file_name: photo?.file_name
      };
    }
  };

  const handleRetouchSingle = async () => {
    if (!selectedPhotoId) return;
    setSubmitting(true);
    const task = await startRetouchForPhoto(selectedPhotoId);
    if (task) {
      setTasks([task]);
      if (task.task_id) startPolling();
    }
    setSubmitting(false);
  };

  const handleRetouchAll = async () => {
    if (photos.length === 0) return;
    setSubmitting(true);

    const serverReady = await ensureServerReady();
    if (!serverReady) {
      setSubmitting(false);
      return;
    }

    const newTasks: RetouchTask[] = [];
    for (const photo of photos) {
      const task = await startRetouchForPhoto(photo.id, true);
      if (task) {
        newTasks.push(task);
        setTasks([...newTasks]);
      }
    }

    setSubmitting(false);
    startPolling();
  };

  const pollTaskStatuses = useCallback(async () => {
    setTasks(prevTasks => {
      const activeTasks = prevTasks.filter(t => t.status === 'queued' || t.status === 'started');
      if (activeTasks.length === 0) {
        stopPolling();
        return prevTasks;
      }
      activeTasks.forEach(async (task) => {
        if (!task.task_id) return;
        try {
          const res = await fetch(`${RETOUCH_API}?task_id=${task.task_id}`, {
            headers: { 'X-User-Id': userId }
          });
          if (!res.ok) return;
          const data = await res.json();
          setTasks(prev => prev.map(t =>
            t.task_id === task.task_id
              ? { ...t, status: data.status, result_url: data.result_url, error_message: data.error_message }
              : t
          ));
        } catch (error) {
          console.error('[RETOUCH] Poll error for task', task.task_id, error);
        }
      });

      return prevTasks;
    });
  }, [userId]);

  const startPolling = () => {
    stopPolling();
    pollIntervalRef.current = setInterval(pollTaskStatuses, 3000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      const allDone = tasks.every(t => t.status === 'finished' || t.status === 'failed' || !t.task_id);
      if (allDone) {
        stopPolling();
        const hasFinished = tasks.some(t => t.status === 'finished');
        if (hasFinished && !retouchCompleteCalledRef.current) {
          retouchCompleteCalledRef.current = true;
          onRetouchComplete?.();
        }
      }
    }
  }, [tasks, onRetouchComplete]);

  const retryTask = async (task: RetouchTask) => {
    setTasks(prev => prev.map(t =>
      t.photo_id === task.photo_id ? { ...t, status: 'queued' as const, error_message: undefined, task_id: '' } : t
    ));
    const newTask = await startRetouchForPhoto(task.photo_id);
    if (newTask) {
      setTasks(prev => prev.map(t =>
        t.photo_id === task.photo_id ? { ...newTask, file_name: task.file_name } : t
      ));
      startPolling();
    }
  };

  const retryAllFailed = async () => {
    const failedTasks = tasks.filter(t => t.status === 'failed');
    setTasks(prev => prev.map(t =>
      t.status === 'failed' ? { ...t, status: 'queued' as const, error_message: undefined, task_id: '' } : t
    ));
    retouchCompleteCalledRef.current = false;
    for (const task of failedTasks) {
      const newTask = await startRetouchForPhoto(task.photo_id);
      if (newTask) {
        setTasks(prev => prev.map(t =>
          t.photo_id === task.photo_id ? { ...newTask, file_name: task.file_name } : t
        ));
      }
    }
    startPolling();
  };

  const hasTasks = tasks.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

        <RetouchTaskList
          tasks={tasks}
          onRetryTask={retryTask}
          onRetryAllFailed={retryAllFailed}
        />

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
            onRetouchSingle={handleRetouchSingle}
            onRetouchAll={handleRetouchAll}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RetouchDialog;