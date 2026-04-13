import { useRef, useCallback, useEffect } from 'react';
import type { RetouchTask } from '@/components/photobank/RetouchTaskList';
import { RETOUCH_API, CLIENT_TASK_TIMEOUT_MS } from './types';
import type { RetouchSession } from './types';

interface UseRetouchPollingArgs {
  tasksRef: React.MutableRefObject<RetouchTask[]>;
  sessionRef: React.MutableRefObject<RetouchSession | null>;
  setTasks: React.Dispatch<React.SetStateAction<RetouchTask[]>>;
}

export const useRetouchPolling = ({ tasksRef, sessionRef, setTasks }: UseRetouchPollingArgs) => {
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartTimeRef = useRef<Record<string, number>>({});
  const pollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollTaskStatuses = useCallback(async () => {
    if (pollingRef.current) return;
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    const currentTasks = tasksRef.current;
    const activeTasks = currentTasks.filter(t => (t.status === 'queued' || t.status === 'started' || t.status === 'processing') && t.task_id);
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
          if ((t.status === 'queued' || t.status === 'started' || t.status === 'processing') && t.created_at) {
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
        } else if (remote.status === 'started' || remote.status === 'processing') {
          if (!pollStartTimeRef.current[t.task_id]) {
            pollStartTimeRef.current[t.task_id] = Date.now();
          }
          const elapsed = (Date.now() - pollStartTimeRef.current[t.task_id]) / 1000;
          const fast = Math.min(60, Math.round((elapsed / 120) * 60));
          const slow = elapsed > 120 ? Math.min(35, Math.round((elapsed - 120) / 480 * 35)) : 0;
          progress = Math.max(progress, Math.min(98, 5 + fast + slow));
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
  }, [tasksRef, sessionRef, setTasks]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollIntervalRef.current = setInterval(pollTaskStatuses, 2000);
  }, [stopPolling, pollTaskStatuses]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    pollIntervalRef,
    pollStartTimeRef,
    startPolling,
    stopPolling,
  };
};