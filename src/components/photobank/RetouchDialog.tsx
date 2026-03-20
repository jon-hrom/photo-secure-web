import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import funcUrls from '@/../backend/func2url.json';
import { playSuccessSound } from '@/utils/notificationSound';
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
  const [minimized, setMinimized] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retouchCompleteCalledRef = useRef(false);
  const batchQueueRef = useRef<Photo[]>([]);
  const batchActiveRef = useRef(false);
  const pollStartTimeRef = useRef<Record<string, number>>({});

  const isProcessing = tasks.some(t => t.status === 'queued' || t.status === 'started') || submitting || waking;

  useEffect(() => {
    if (open && folderId && !minimized) {
      loadPhotos();
    }
  }, [open, folderId]);

  const fullClose = () => {
    stopPolling();
    batchQueueRef.current = [];
    batchActiveRef.current = false;
    setPhotos([]);
    setSelectedPhotoId(null);
    setTasks([]);
    setSubmitting(false);
    setWaking(false);
    setWakeStatus(null);
    setActiveTab('single');
    retouchCompleteCalledRef.current = false;
    pollStartTimeRef.current = {};
    setMinimized(false);
    onOpenChange(false);
  };

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen && isProcessing) {
      setMinimized(true);
      return;
    }
    if (!newOpen) {
      fullClose();
    }
  };

  const handleRestore = () => {
    setMinimized(false);
    onOpenChange(true);
  };

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
    try {
      const res = await fetch(`${RETOUCH_WAKER_API}?action=wake`, { method: 'POST' });
      if (!res.ok) {
        setWakeStatus('Не удалось запустить сервис. Попробуйте позже');
        setWaking(false);
        return false;
      }
      const data = await res.json();

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

  const startRetouchForPhoto = async (photoId: number, retriesLeft = 3): Promise<RetouchTask | null> => {
    const photo = photos.find(p => p.id === photoId);
    try {
      const res = await fetch(RETOUCH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ photo_id: photoId })
      });
      if ((res.status === 502 || res.status === 504) && retriesLeft > 0) {
        if (retriesLeft === 3) {
          const woken = await wakeRetouchServer();
          if (!woken) {
            return { photo_id: photoId, task_id: '', status: 'failed', error_message: 'Сервис не запустился', file_name: photo?.file_name };
          }
        } else {
          await new Promise(r => setTimeout(r, 5000));
        }
        return startRetouchForPhoto(photoId, retriesLeft - 1);
      }
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      return {
        photo_id: photoId,
        task_id: data.task_id,
        status: data.status || 'queued',
        progress: 0,
        file_name: photo?.file_name
      };
    } catch (error) {
      console.error('[RETOUCH] Failed to start retouch for photo', photoId, error);
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

    const serverReady = await ensureServerReady();
    if (!serverReady) {
      setSubmitting(false);
      return;
    }

    const task = await startRetouchForPhoto(selectedPhotoId);
    if (task) {
      setTasks([task]);
      if (task.task_id) startPolling();
    }
    setSubmitting(false);
  };

  const processNextInBatch = useCallback(async () => {
    if (batchQueueRef.current.length === 0) {
      batchActiveRef.current = false;
      setSubmitting(false);
      return;
    }

    const photo = batchQueueRef.current.shift()!;
    const task = await startRetouchForPhoto(photo.id);
    if (task) {
      setTasks(prev => [...prev, task]);
      if (task.task_id) startPolling();
    } else {
      processNextInBatch();
    }
  }, []);

  useEffect(() => {
    if (!batchActiveRef.current) return;
    const lastTask = tasks[tasks.length - 1];
    if (lastTask && (lastTask.status === 'finished' || lastTask.status === 'failed') && batchQueueRef.current.length > 0) {
      processNextInBatch();
    }
  }, [tasks, processNextInBatch]);

  const handleRetouchAll = async () => {
    if (photos.length === 0) return;
    setSubmitting(true);

    const serverReady = await ensureServerReady();
    if (!serverReady) {
      setSubmitting(false);
      return;
    }

    batchQueueRef.current = [...photos.slice(1)];
    batchActiveRef.current = true;

    const firstTask = await startRetouchForPhoto(photos[0].id);
    if (firstTask) {
      setTasks([firstTask]);
      if (firstTask.task_id) startPolling();
    } else {
      processNextInBatch();
    }
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
        if (!pollStartTimeRef.current[task.task_id]) {
          pollStartTimeRef.current[task.task_id] = Date.now();
        }
        try {
          const res = await fetch(`${RETOUCH_API}?task_id=${task.task_id}`, {
            headers: { 'X-User-Id': userId }
          });
          if (!res.ok) return;
          const data = await res.json();

          let progress = 0;
          if (data.status === 'finished') {
            progress = 100;
          } else if (data.status === 'started') {
            const elapsed = (Date.now() - pollStartTimeRef.current[task.task_id]) / 1000;
            const avgTime = 15;
            progress = Math.min(95, Math.round((elapsed / avgTime) * 80) + 10);
          } else if (data.status === 'queued') {
            progress = 5;
          }

          setTasks(prev => prev.map(t =>
            t.task_id === task.task_id
              ? { ...t, status: data.status, result_url: data.result_url, error_message: data.error_message, progress }
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
          playSuccessSound();
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

  const totalProgress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => {
        if (t.status === 'finished') return sum + 100;
        if (t.status === 'failed') return sum + 100;
        return sum + (t.progress || 0);
      }, 0) / tasks.length)
    : 0;

  if (minimized && (isProcessing || hasTasks)) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-gradient-to-r from-rose-600 to-purple-600 text-white rounded-full pl-4 pr-2 py-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
        onClick={handleRestore}
      >
        <Icon name="Sparkles" size={16} className="flex-shrink-0" />
        <span className="text-sm font-medium">Ретушь</span>
        {isProcessing ? (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums">{totalProgress}%</span>
          </div>
        ) : (
          <span className="text-xs opacity-80">
            {tasks.filter(t => t.status === 'finished').length}/{tasks.length}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            fullClose();
          }}
          className="flex-shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors ml-1"
          title="Остановить и закрыть"
        >
          <Icon name="X" size={14} />
        </button>
      </div>
    );
  }

  if (minimized && !isProcessing && !hasTasks) {
    return null;
  }

  return (
    <Dialog open={open && !minimized} onOpenChange={handleDialogChange}>
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
