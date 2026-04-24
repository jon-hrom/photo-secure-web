import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { OpConfig, opsToJson } from '../retouchTypes';

const PRESETS_API = 'https://functions.poehali.dev/885fca99-51b3-4dd5-97da-cde77d340794';
const RETOUCH_API = 'https://functions.poehali.dev/c95989eb-d7f0-4fac-b9c9-f8ab0fb61aff';

interface UseRetouchTestingArgs {
  userId: string;
  currentPreviewPhotoId: number | string | undefined;
  autoMode: boolean;
  ops: OpConfig[];
}

export function useRetouchTesting({
  userId,
  currentPreviewPhotoId,
  autoMode,
  ops,
}: UseRetouchTestingArgs) {
  const [retouchedUrl, setRetouchedUrl] = useState<string | null>(null);
  const [testingRetouch, setTestingRetouch] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollTaskStatus = useCallback((taskId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${RETOUCH_API}?task_id=${taskId}`, {
          headers: { 'X-User-Id': userId },
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'finished' && data.result_url) {
          if (pollRef.current) clearInterval(pollRef.current);
          console.log('[RETOUCH] result_url:', data.result_url);
          setRetouchedUrl(data.result_url);
          setTestingRetouch(false);
        } else if (data.status === 'failed' || data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
          setTestingRetouch(false);
          toast({
            title: 'Ошибка превью',
            description: data.error_message || 'Не удалось обработать фото',
            variant: 'destructive',
          });
        }
      } catch { /* polling error */ }
    }, 2000);
  }, [userId, toast]);

  const handleTestRetouch = async () => {
    if (!currentPreviewPhotoId) {
      toast({ title: 'Выберите фото для превью', variant: 'destructive' });
      return;
    }

    setTestingRetouch(true);
    setRetouchedUrl(null);

    try {
      let presetToUse = 'preview';

      if (autoMode) {
        presetToUse = 'auto';
      } else {
        const pipeline = opsToJson(ops);
        const saveRes = await fetch(PRESETS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
          body: JSON.stringify({ name: 'preview', pipeline_json: pipeline, is_default: false }),
        });
        if (!saveRes.ok) throw new Error('Не удалось сохранить пресет');
      }

      const res = await fetch(RETOUCH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ photo_id: currentPreviewPhotoId, preset: presetToUse }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Ошибка запуска ретуши');
      }

      const data = await res.json();
      if (data.task_id) {
        pollTaskStatus(data.task_id);
      }
    } catch (e: unknown) {
      setTestingRetouch(false);
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось запустить превью',
        variant: 'destructive',
      });
    }
  };

  return {
    retouchedUrl,
    setRetouchedUrl,
    testingRetouch,
    handleTestRetouch,
  };
}
