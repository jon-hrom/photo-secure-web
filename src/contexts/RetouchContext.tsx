import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { playSuccessSound } from '@/utils/notificationSound';
import type { RetouchTask } from '@/components/photobank/RetouchTaskList';

const RETOUCH_API = 'https://functions.poehali.dev/c95989eb-d7f0-4fac-b9c9-f8ab0fb61aff';
const RETOUCH_WAKER_API = 'https://functions.poehali.dev/d668813e-6fa2-4d11-b5bf-4bb013473dbc';
const CONCURRENT_LIMIT = 1;
const CLIENT_TASK_TIMEOUT_MS = 10 * 60 * 1000;

interface RetouchSession {
  folderId: number;
  folderName: string;
  userId: string;
  onRetouchComplete?: () => void;
}

interface RetouchContextValue {
  tasks: RetouchTask[];
  photos: Photo[];
  isProcessing: boolean;
  waking: boolean;
  wakeStatus: string | null;
  submitting: boolean;
  minimized: boolean;
  session: RetouchSession | null;
  totalProgress: number;
  totalBatchSize: number;
  setMinimized: (v: boolean) => void;
  startSession: (session: RetouchSession) => void;
  fullClose: () => void;
  handleRetouchSingle: (photoId: number, photos: Photo[]) => Promise<void>;
  handleRetouchAll: (photos: Photo[]) => Promise<void>;
  retryTask: (task: RetouchTask) => Promise<void>;
  retryAllFailed: () => Promise<void>;
}

interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  data_url?: string;
}

const RetouchContext = createContext<RetouchContextValue | null>(null);

export const useRetouch = () => {
  const ctx = useContext(RetouchContext);
  if (!ctx) throw new Error('useRetouch must be used within RetouchProvider');
  return ctx;
};

export const RetouchProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<RetouchTask[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [waking, setWaking] = useState(false);
  const [wakeStatus, setWakeStatus] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [session, setSession] = useState<RetouchSession | null>(null);
  const [batchPending, setBatchPending] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retouchCompleteCalledRef = useRef(false);
  const batchQueueRef = useRef<Photo[]>([]);
  const activeSubmitsRef = useRef(0);
  const pollStartTimeRef = useRef<Record<string, number>>({});
  const photosRef = useRef<Photo[]>([]);
  const serverStartedRef = useRef(false);
  const sessionRef = useRef<RetouchSession | null>(null);
  const totalBatchSizeRef = useRef(0);

  const isProcessing = tasks.some(t => t.status === 'queued' || t.status === 'started') || submitting || waking || batchPending;

  const totalBatchSize = totalBatchSizeRef.current > tasks.length ? totalBatchSizeRef.current : tasks.length;

  const [fakeProgress, setFakeProgress] = useState(0);

  useEffect(() => {
    const hasStartedNoId = tasks.some(t => t.status === 'started' && !t.task_id);
    if (!hasStartedNoId) {
      setFakeProgress(0);
      return;
    }
    setFakeProgress(5);
    const interval = setInterval(() => {
      setFakeProgress(prev => prev < 85 ? prev + 2 : prev);
    }, 1000);
    return () => clearInterval(interval);
  }, [tasks]);

  const totalProgress = (() => {
    if (tasks.length === 0) return 0;
    const total = totalBatchSize || tasks.length;
    const done = tasks.reduce((sum, t) => {
      if (t.status === 'finished') return sum + 100;
      if (t.status === 'failed') return sum + 100;
      if (t.status === 'started' && !t.task_id) return sum + fakeProgress;
      return sum + (t.progress || 0);
    }, 0);
    return Math.round(done / total);
  })();

  const markActive = () => {
    serverStartedRef.current = true;
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const tasksRef = useRef<RetouchTask[]>([]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const pollingRef = useRef(false);

  const pollTaskStatuses = useCallback(async () => {
    if (pollingRef.current) return;
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    const currentTasks = tasksRef.current;
    const activeTasks = currentTasks.filter(t => (t.status === 'queued' || t.status === 'started') && t.task_id);
    if (activeTasks.length === 0) return;

    pollingRef.current = true;
    try {
      const taskIds = activeTasks.map(t => t.task_id).join(',');
      const res = await fetch(`${RETOUCH_API}?task_ids=${encodeURIComponent(taskIds)}`, {
        headers: { 'X-User-Id': currentSession.userId }
      });
      if (!res.ok) {
        console.warn('[RETOUCH] Poll response not ok:', res.status);
        return;
      }
      const data = await res.json();
      if (!data?.tasks) {
        console.warn('[RETOUCH] Poll response has no tasks:', data);
        return;
      }

      const statuses = data.tasks.map((t: { task_id?: string; status?: string }) => `${t.task_id?.slice(0,8)}=${t.status}`);
      console.log(`[RETOUCH] Poll: ${data.tasks.length} tasks, statuses: ${statuses.join(', ')}`);

      const resultsMap: Record<string, (typeof data.tasks)[0]> = {};
      for (const r of data.tasks) {
        resultsMap[r.task_id] = r;
      }

      setTasks(prev => prev.map(t => {
        const remote = resultsMap[t.task_id];
        if (!remote) {
          if ((t.status === 'queued' || t.status === 'started') && t.created_at) {
            const age = Date.now() - new Date(t.created_at).getTime();
            if (age > CLIENT_TASK_TIMEOUT_MS) {
              return { ...t, status: 'failed' as const, error_message: 'Таймаут: задача не завершилась вовремя', progress: 0 };
            }
          }
          return t;
        }

        let progress = t.progress || 0;
        if (remote.status === 'finished') {
          progress = 100;
        } else if (remote.status === 'started') {
          if (!pollStartTimeRef.current[t.task_id]) {
            pollStartTimeRef.current[t.task_id] = Date.now();
          }
          const elapsed = (Date.now() - pollStartTimeRef.current[t.task_id]) / 1000;
          progress = Math.min(90, Math.round((elapsed / 45) * 80) + 10);
        } else if (remote.status === 'queued') {
          progress = 5;
        }

        return {
          ...t,
          status: remote.status,
          result_url: remote.result_url,
          error_message: remote.error_message,
          progress
        };
      }));
    } catch (err) {
      console.error('[RETOUCH] Batch poll error:', err);
    } finally {
      pollingRef.current = false;
    }
  }, []);

  const startPolling = () => {
    stopPolling();
    pollIntervalRef.current = setInterval(pollTaskStatuses, 2000);
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  useEffect(() => {
    if (tasks.length === 0) return;

    const hasActive = tasks.some(t => (t.status === 'queued' || t.status === 'started') && t.task_id);
    const allDone = !batchPending && tasks.every(t => t.status === 'finished' || t.status === 'failed' || !t.task_id);

    if (hasActive && !pollIntervalRef.current) {
      startPolling();
    }

    if (allDone) {
      stopPolling();
      const hasFinished = tasks.some(t => t.status === 'finished');
      if (hasFinished && !retouchCompleteCalledRef.current) {
        retouchCompleteCalledRef.current = true;
        playSuccessSound();
        session?.onRetouchComplete?.();
      }
    }
  }, [tasks, session, batchPending]);

  const wakeRetouchServer = async (): Promise<boolean> => {
    if (!sessionRef.current) return false;
    try {
      const res = await fetch(`${RETOUCH_WAKER_API}?action=wake`, { method: 'POST' });
      if (!res.ok) {
        setWakeStatus('Не удалось запустить сервис. Попробуйте позже');
        setWaking(false);
        return false;
      }
      const data = await res.json();

      if (data.action === 'already_running') {
        setWakeStatus(null);
        setWaking(false);
        markActive();
        return true;
      }

      setWaking(true);
      setWakeStatus('waking');

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
                markActive();
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
    markActive();
    try {
      const probe = await fetch(`${RETOUCH_WAKER_API}?probe=1`, { signal: AbortSignal.timeout(8000) });
      if (probe.ok) {
        const data = await probe.json();
        if (data.probe?.reachable) return true;
      }
    } catch { /* not reachable */ }
    return await wakeRetouchServer();
  };

  const startRetouchForPhoto = async (photoId: number, retriesLeft = 3): Promise<RetouchTask | null> => {
    if (!sessionRef.current) return null;
    const photo = photosRef.current.find(p => p.id === photoId);
    try {
      const res = await fetch(RETOUCH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': sessionRef.current.userId
        },
        body: JSON.stringify({ photo_id: photoId })
      });
      if (res.status === 429 && retriesLeft > 0) {
        console.log(`[RETOUCH] Queue full for photo ${photoId}, waiting 10s before retry...`);
        await new Promise(r => setTimeout(r, 10000));
        return startRetouchForPhoto(photoId, retriesLeft - 1);
      }
      if (res.status === 503 && retriesLeft > 0) {
        console.log(`[RETOUCH] Server warming up for photo ${photoId}, waking and retrying...`);
        const woken = await wakeRetouchServer();
        if (!woken) {
          return { photo_id: photoId, task_id: '', status: 'failed', error_message: 'Сервер ретуши не запустился', file_name: photo?.file_name };
        }
        await new Promise(r => setTimeout(r, 5000));
        return startRetouchForPhoto(photoId, retriesLeft - 1);
      }
      if ((res.status === 502 || res.status === 504) && retriesLeft > 0) {
        if (retriesLeft === 3) {
          const woken = await wakeRetouchServer();
          if (!woken) {
            return { photo_id: photoId, task_id: '', status: 'failed', error_message: 'Сервис не запустился', file_name: photo?.file_name };
          }
        } else {
          await new Promise(r => setTimeout(r, 3000));
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
        file_name: photo?.file_name,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[RETOUCH] Failed for photo', photoId, error);
      return {
        photo_id: photoId,
        task_id: '',
        status: 'failed',
        error_message: 'Не удалось запустить ретушь',
        file_name: photo?.file_name
      };
    }
  };

  const checkBatchDone = () => {
    if (batchQueueRef.current.length === 0 && activeSubmitsRef.current === 0) {
      setBatchPending(false);
      setSubmitting(false);
    }
  };

  const waitForTaskCompletion = (taskId: string, timeoutMs = 10 * 60 * 1000): Promise<string> => {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const current = tasksRef.current.find(t => t.task_id === taskId);
        if (current && (current.status === 'finished' || current.status === 'failed')) {
          resolve(current.status);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          resolve('timeout');
          return;
        }
        setTimeout(check, 2000);
      };
      setTimeout(check, 3000);
    });
  };

  const submitOne = async (slotId: number) => {
    if (batchQueueRef.current.length === 0) {
      checkBatchDone();
      return;
    }
    const photo = batchQueueRef.current.shift()!;
    activeSubmitsRef.current++;
    console.log(`[RETOUCH] Slot ${slotId}: submitting photo ${photo.id} (${photo.file_name}), active=${activeSubmitsRef.current}, queue=${batchQueueRef.current.length}`);

    let taskId = '';
    try {
      const task = await startRetouchForPhoto(photo.id);
      if (task) {
        taskId = task.task_id;
        setTasks(prev => [...prev, task]);
      }
    } finally {
      activeSubmitsRef.current--;
      console.log(`[RETOUCH] Slot ${slotId}: submitted photo ${photo.id}, task=${taskId}, active=${activeSubmitsRef.current}, queue=${batchQueueRef.current.length}`);
    }

    if (batchQueueRef.current.length > 0) {
      if (taskId) {
        console.log(`[RETOUCH] Slot ${slotId}: waiting for task ${taskId} to complete before next photo...`);
        const result = await waitForTaskCompletion(taskId);
        console.log(`[RETOUCH] Slot ${slotId}: task ${taskId} completed with status: ${result}`);
      }
      await new Promise(r => setTimeout(r, 1500));
      submitOne(slotId);
    } else {
      checkBatchDone();
    }
  };

  const drainQueue = useCallback(() => {
    const toStart = Math.min(CONCURRENT_LIMIT - activeSubmitsRef.current, batchQueueRef.current.length);
    console.log(`[RETOUCH] drainQueue: starting ${toStart} slots, queue=${batchQueueRef.current.length}, active=${activeSubmitsRef.current}`);
    for (let i = 0; i < toStart; i++) {
      submitOne(i);
    }
  }, []);

  const startSession = (newSession: RetouchSession) => {
    if (sessionRef.current && (isProcessing || tasks.length > 0)) {
      sessionRef.current = { ...sessionRef.current, onRetouchComplete: newSession.onRetouchComplete };
      setSession(prev => prev ? { ...prev, onRetouchComplete: newSession.onRetouchComplete } : newSession);
      return;
    }
    setSession(newSession);
    sessionRef.current = newSession;
    setMinimized(false);
    retouchCompleteCalledRef.current = false;
  };

  const fullClose = () => {
    stopPolling();
    batchQueueRef.current = [];
    activeSubmitsRef.current = 0;
    setBatchPending(false);
    totalBatchSizeRef.current = 0;
    photosRef.current = [];

    const hadFinished = tasks.some(t => t.status === 'finished');
    if (hadFinished) {
      sessionRef.current?.onRetouchComplete?.();
    }

    setTasks([]);
    setSubmitting(false);
    setWaking(false);
    setWakeStatus(null);
    retouchCompleteCalledRef.current = false;
    pollStartTimeRef.current = {};
    setMinimized(false);
    setSession(null);
    sessionRef.current = null;
  };

  const handleRetouchSingle = async (photoId: number, photos: Photo[]) => {
    photosRef.current = photos;
    setPhotos(photos);
    totalBatchSizeRef.current = 1;
    setSubmitting(true);
    const photo = photos.find(p => p.id === photoId);
    const pendingTask: RetouchTask = {
      photo_id: photoId,
      task_id: '',
      status: 'started',
      progress: 0,
      file_name: photo?.file_name,
      created_at: new Date().toISOString()
    };
    setTasks([pendingTask]);
    const serverReady = await ensureServerReady();
    if (!serverReady) {
      setTasks([{ ...pendingTask, status: 'failed', error_message: 'Сервис недоступен' }]);
      setSubmitting(false);
      return;
    }
    const task = await startRetouchForPhoto(photoId);
    if (task) {
      setTasks([task]);
    } else {
      setTasks([{ ...pendingTask, status: 'failed', error_message: 'Не удалось запустить ретушь' }]);
    }
    setSubmitting(false);
  };

  const handleRetouchAll = async (photos: Photo[]) => {
    if (photos.length === 0) return;
    photosRef.current = photos;
    setPhotos(photos);
    totalBatchSizeRef.current = photos.length;
    setSubmitting(true);
    setBatchPending(true);
    const serverReady = await ensureServerReady();
    if (!serverReady) {
      setSubmitting(false);
      setBatchPending(false);
      return;
    }
    batchQueueRef.current = [...photos];
    activeSubmitsRef.current = 0;
    drainQueue();
  };

  const retryTask = async (task: RetouchTask) => {
    markActive();
    setTasks(prev => prev.map(t =>
      t.photo_id === task.photo_id ? { ...t, status: 'queued' as const, error_message: undefined, task_id: '' } : t
    ));
    const newTask = await startRetouchForPhoto(task.photo_id);
    if (newTask) {
      setTasks(prev => prev.map(t =>
        t.photo_id === task.photo_id ? { ...newTask, file_name: task.file_name } : t
      ));
    }
  };

  const retryAllFailed = async () => {
    markActive();
    const failedTasks = tasks.filter(t => t.status === 'failed');
    setTasks(prev => prev.map(t =>
      t.status === 'failed' ? { ...t, status: 'queued' as const, error_message: undefined, task_id: '' } : t
    ));
    retouchCompleteCalledRef.current = false;
    setBatchPending(true);
    batchQueueRef.current = failedTasks.map(t => ({ id: t.photo_id, file_name: t.file_name || '' }));
    activeSubmitsRef.current = 0;
    drainQueue();
  };

  return (
    <RetouchContext.Provider value={{
      tasks, photos, isProcessing, waking, wakeStatus, submitting, minimized, session,
      totalProgress, totalBatchSize, setMinimized, startSession, fullClose,
      handleRetouchSingle, handleRetouchAll, retryTask, retryAllFailed
    }}>
      {children}
    </RetouchContext.Provider>
  );
};

export default RetouchContext;