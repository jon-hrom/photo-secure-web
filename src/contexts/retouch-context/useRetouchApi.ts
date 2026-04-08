import { useRef, useCallback } from 'react';
import type { RetouchTask } from '@/components/photobank/RetouchTaskList';
import { RETOUCH_API, RETOUCH_WAKER_API, CONCURRENT_LIMIT } from './types';
import type { RetouchSession, Photo } from './types';

interface UseRetouchApiArgs {
  sessionRef: React.MutableRefObject<RetouchSession | null>;
  photosRef: React.MutableRefObject<Photo[]>;
  tasksRef: React.MutableRefObject<RetouchTask[]>;
  setTasks: React.Dispatch<React.SetStateAction<RetouchTask[]>>;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setBatchPending: React.Dispatch<React.SetStateAction<boolean>>;
  setWaking: React.Dispatch<React.SetStateAction<boolean>>;
  setWakeStatus: React.Dispatch<React.SetStateAction<string | null>>;
  serverStartedRef: React.MutableRefObject<boolean>;
}

export const useRetouchApi = ({
  sessionRef,
  photosRef,
  tasksRef,
  setTasks,
  setSubmitting,
  setBatchPending,
  setWaking,
  setWakeStatus,
  serverStartedRef,
}: UseRetouchApiArgs) => {
  const batchQueueRef = useRef<Photo[]>([]);
  const activeSubmitsRef = useRef(0);
  const totalBatchSizeRef = useRef(0);

  const markActive = useCallback(() => {
    serverStartedRef.current = true;
  }, [serverStartedRef]);

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
        const maxWait = 180;
        const interval = 4;
        let vmRunning = false;
        for (let elapsed = 0; elapsed < maxWait; elapsed += interval) {
          await new Promise(r => setTimeout(r, interval * 1000));
          try {
            const probe = await fetch(`${RETOUCH_WAKER_API}?probe=1`, { signal: AbortSignal.timeout(10000) });
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
          if (!vmRunning && elapsed >= 20) {
            try {
              const statusRes = await fetch(`${RETOUCH_WAKER_API}?action=wake`, { method: 'POST' });
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.action === 'already_running') {
                  vmRunning = true;
                  setWakeStatus('vm_ready');
                }
              }
            } catch { /* ignore */ }
          }
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
        body: JSON.stringify({ photo_id: photoId, preset: 'preview' })
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

  return {
    batchQueueRef,
    activeSubmitsRef,
    totalBatchSizeRef,
    markActive,
    ensureServerReady,
    startRetouchForPhoto,
    drainQueue,
  };
};
