import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import funcUrls from '@/../backend/func2url.json';
import { playSuccessSound } from '@/utils/notificationSound';
import type { RetouchTask } from '@/components/photobank/RetouchTaskList';

const RETOUCH_API = funcUrls['retouch'];
const RETOUCH_WAKER_API = funcUrls['retouch-waker'];
const IDLE_SHUTDOWN_MS = 10 * 60 * 1000;

interface RetouchSession {
  folderId: number;
  folderName: string;
  userId: string;
  onRetouchComplete?: () => void;
}

interface RetouchContextValue {
  tasks: RetouchTask[];
  isProcessing: boolean;
  waking: boolean;
  wakeStatus: string | null;
  submitting: boolean;
  minimized: boolean;
  session: RetouchSession | null;
  totalProgress: number;
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

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retouchCompleteCalledRef = useRef(false);
  const batchQueueRef = useRef<Photo[]>([]);
  const batchActiveRef = useRef(false);
  const pollStartTimeRef = useRef<Record<string, number>>({});
  const photosRef = useRef<Photo[]>([]);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverStartedRef = useRef(false);
  const sessionRef = useRef<RetouchSession | null>(null);

  const isProcessing = tasks.some(t => t.status === 'queued' || t.status === 'started') || submitting || waking;

  const totalProgress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => {
        if (t.status === 'finished') return sum + 100;
        if (t.status === 'failed') return sum + 100;
        return sum + (t.progress || 0);
      }, 0) / tasks.length)
    : 0;

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const stopServer = async () => {
    if (!serverStartedRef.current) return;
    try {
      console.log('[RETOUCH] Auto-stopping server after 10 min idle');
      await fetch(`${RETOUCH_WAKER_API}?action=stop`, { method: 'POST' });
      serverStartedRef.current = false;
    } catch (error) {
      console.error('[RETOUCH] Failed to stop server:', error);
    }
  };

  const scheduleIdleShutdown = () => {
    clearIdleTimer();
    if (!serverStartedRef.current) return;
    console.log('[RETOUCH] Scheduling idle shutdown in 10 min');
    idleTimerRef.current = setTimeout(stopServer, IDLE_SHUTDOWN_MS);
  };

  const markActive = () => {
    serverStartedRef.current = true;
    clearIdleTimer();
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const pollTaskStatuses = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

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
            headers: { 'X-User-Id': currentSession.userId }
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
  }, []);

  const startPolling = () => {
    stopPolling();
    pollIntervalRef.current = setInterval(pollTaskStatuses, 3000);
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      const allDone = tasks.every(t => t.status === 'finished' || t.status === 'failed' || !t.task_id);
      if (allDone) {
        stopPolling();
        scheduleIdleShutdown();
        const hasFinished = tasks.some(t => t.status === 'finished');
        if (hasFinished && !retouchCompleteCalledRef.current) {
          retouchCompleteCalledRef.current = true;
          playSuccessSound();
          session?.onRetouchComplete?.();
        }
      }
    }
  }, [tasks, session]);

  const wakeRetouchServer = async (): Promise<boolean> => {
    if (!sessionRef.current) return false;
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
        markActive();
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
    } catch { /* server not reachable */ }
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

  const startSession = (newSession: RetouchSession) => {
    setSession(newSession);
    sessionRef.current = newSession;
    setMinimized(false);
    retouchCompleteCalledRef.current = false;
  };

  const fullClose = () => {
    stopPolling();
    batchQueueRef.current = [];
    batchActiveRef.current = false;
    photosRef.current = [];
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
    setSubmitting(true);
    const serverReady = await ensureServerReady();
    if (!serverReady) {
      setSubmitting(false);
      return;
    }
    const task = await startRetouchForPhoto(photoId);
    if (task) {
      setTasks([task]);
      if (task.task_id) startPolling();
    }
    setSubmitting(false);
  };

  const handleRetouchAll = async (photos: Photo[]) => {
    if (photos.length === 0) return;
    photosRef.current = photos;
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
      startPolling();
    }
  };

  const retryAllFailed = async () => {
    markActive();
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

  return (
    <RetouchContext.Provider value={{
      tasks, isProcessing, waking, wakeStatus, submitting, minimized, session,
      totalProgress, setMinimized, startSession, fullClose,
      handleRetouchSingle, handleRetouchAll, retryTask, retryAllFailed
    }}>
      {children}
    </RetouchContext.Provider>
  );
};

export default RetouchContext;