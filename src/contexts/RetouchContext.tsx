import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { playSuccessSound } from '@/utils/notificationSound';
import type { RetouchTask } from '@/components/photobank/RetouchTaskList';
import type { RetouchSession, Photo, RetouchContextValue } from './retouch-context/types';
import { useRetouchPolling } from './retouch-context/useRetouchPolling';
import { useRetouchApi } from './retouch-context/useRetouchApi';

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
  const [lightboxData, setLightboxData] = useState<{ tasks: RetouchTask[]; startIndex: number } | null>(null);
  const lightboxDataRef = useRef<typeof lightboxData>(null);

  const openRetouchLightbox = useCallback((tasks: RetouchTask[], startIndex: number) => {
    const data = { tasks, startIndex };
    lightboxDataRef.current = data;
    setLightboxData(data);
  }, []);

  const closeRetouchLightbox = useCallback(() => {
    lightboxDataRef.current = null;
    setLightboxData(null);
  }, []);

  const retouchCompleteCalledRef = useRef(false);
  const photosRef = useRef<Photo[]>([]);
  const serverStartedRef = useRef(false);
  const sessionRef = useRef<RetouchSession | null>(null);

  const tasksRef = useRef<RetouchTask[]>([]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const { pollIntervalRef, pollStartTimeRef, startPolling, stopPolling } = useRetouchPolling({
    tasksRef,
    sessionRef,
    setTasks,
  });

  const {
    batchQueueRef,
    activeSubmitsRef,
    totalBatchSizeRef,
    markActive,
    ensureServerReady,
    startRetouchForPhoto,
    drainQueue,
  } = useRetouchApi({
    sessionRef,
    photosRef,
    tasksRef,
    setTasks,
    setSubmitting,
    setBatchPending,
    setWaking,
    setWakeStatus,
    serverStartedRef,
  });

  const isProcessing = tasks.some(t => t.status === 'queued' || t.status === 'started' || t.status === 'processing') || submitting || waking || batchPending;

  const totalBatchSize = totalBatchSizeRef.current > tasks.length ? totalBatchSizeRef.current : tasks.length;

  const [fakeProgress, setFakeProgress] = useState(0);
  const fakeActiveRef = useRef(false);
  const fakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const hasStartedNoId = tasks.some(t => t.status === 'started' && !t.task_id);
    if (hasStartedNoId && !fakeActiveRef.current) {
      fakeActiveRef.current = true;
      setFakeProgress(5);
      if (fakeIntervalRef.current) clearInterval(fakeIntervalRef.current);
      fakeIntervalRef.current = setInterval(() => {
        setFakeProgress(prev => prev < 85 ? prev + 2 : prev);
      }, 1000);
    } else if (!hasStartedNoId && fakeActiveRef.current) {
      fakeActiveRef.current = false;
      if (fakeIntervalRef.current) {
        clearInterval(fakeIntervalRef.current);
        fakeIntervalRef.current = null;
      }
      setFakeProgress(0);
    }
    return () => {
      if (!fakeActiveRef.current && fakeIntervalRef.current) {
        clearInterval(fakeIntervalRef.current);
        fakeIntervalRef.current = null;
      }
    };
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

  useEffect(() => {
    if (tasks.length === 0) return;

    const hasActive = tasks.some(t => (t.status === 'queued' || t.status === 'started' || t.status === 'processing') && t.task_id);
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
  }, [tasks, session, batchPending, startPolling, stopPolling, pollIntervalRef]);

  const startSession = (newSession: RetouchSession) => {
    if (sessionRef.current && isProcessing) {
      sessionRef.current = { ...sessionRef.current, onRetouchComplete: newSession.onRetouchComplete };
      setSession(prev => prev ? { ...prev, onRetouchComplete: newSession.onRetouchComplete } : newSession);
      return;
    }
    if (tasks.length > 0 && !isProcessing) {
      stopPolling();
      setTasks([]);
      batchQueueRef.current = [];
      activeSubmitsRef.current = 0;
      setBatchPending(false);
      totalBatchSizeRef.current = 0;
      setSubmitting(false);
      pollStartTimeRef.current = {};
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
      handleRetouchSingle, handleRetouchAll, retryTask, retryAllFailed,
      lightboxData, lightboxDataRef, openRetouchLightbox, closeRetouchLightbox
    }}>
      {children}
    </RetouchContext.Provider>
  );
};

export default RetouchContext;