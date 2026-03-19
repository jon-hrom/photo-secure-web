import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import funcUrls from '@/../backend/func2url.json';

const RETOUCH_API = funcUrls['retouch'];
const WAKE_RETOUCH_API = funcUrls['wake-retouch'];
const PHOTOBANK_FOLDERS_API = funcUrls['photobank-folders'];

interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  data_url?: string;
}

interface RetouchTask {
  photo_id: number;
  task_id: string;
  status: 'queued' | 'started' | 'finished' | 'failed';
  result_url?: string;
  error_message?: string;
  file_name?: string;
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

  // Load photos when dialog opens
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
    setWakeStatus('Запускаем сервер ретуши...');
    console.log('[RETOUCH] Waking retouch server...');
    try {
      const res = await fetch(WAKE_RETOUCH_API, { method: 'POST' });
      if (!res.ok) {
        setWakeStatus('Не удалось разбудить сервер');
        setWaking(false);
        return false;
      }
      const data = await res.json();
      console.log('[RETOUCH] Wake response:', data);

      if (data.action === 'already_running') {
        setWakeStatus('Сервер уже работает');
        setWaking(false);
        return true;
      }

      if (data.action === 'starting' || data.action === 'already_starting') {
        setWakeStatus('Сервер запускается, ожидаем готовности (~60 сек)...');
        const maxWait = 90;
        const interval = 5;
        for (let elapsed = 0; elapsed < maxWait; elapsed += interval) {
          await new Promise(r => setTimeout(r, interval * 1000));
          setWakeStatus(`Сервер запускается... ${elapsed + interval} сек`);
          try {
            const probe = await fetch(`${RETOUCH_API}?probe=1`, { signal: AbortSignal.timeout(8000) });
            if (probe.ok) {
              const probeData = await probe.json();
              if (probeData.probe?.reachable) {
                setWakeStatus('Сервер готов!');
                setWaking(false);
                return true;
              }
            }
          } catch { /* still starting */ }
        }
        setWakeStatus('Сервер не успел запуститься, попробуйте позже');
        setWaking(false);
        return false;
      }

      setWakeStatus(null);
      setWaking(false);
      return true;
    } catch (error) {
      console.error('[RETOUCH] Wake failed:', error);
      setWakeStatus('Ошибка при запуске сервера');
      setWaking(false);
      return false;
    }
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
      if (res.status === 502 && !isRetryAfterWake) {
        console.log('[RETOUCH] Got 502, attempting to wake server...');
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
      startPolling();
    }
    setSubmitting(false);
  };

  const handleRetouchAll = async () => {
    if (photos.length === 0) return;
    setSubmitting(true);
    const newTasks: RetouchTask[] = [];

    for (const photo of photos) {
      const task = await startRetouchForPhoto(photo.id);
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
      // Poll each active task
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

  // Cleanup polling on unmount
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

  const getPhotoThumb = (photo: Photo) => {
    return photo.thumbnail_s3_url || photo.data_url || photo.s3_url || '';
  };

  const finishedCount = tasks.filter(t => t.status === 'finished').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const activeCount = tasks.filter(t => t.status === 'queued' || t.status === 'started').length;
  const hasTasks = tasks.length > 0;

  const statusLabel = (status: string) => {
    switch (status) {
      case 'queued': return 'В очереди';
      case 'started': return 'Обработка...';
      case 'finished': return 'Готово';
      case 'failed': return 'Ошибка';
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'text-yellow-600';
      case 'started': return 'text-blue-600';
      case 'finished': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

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

        {waking && wakeStatus && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/50 p-4 flex items-center gap-3">
            <Icon name="Loader2" size={18} className="animate-spin text-amber-600 flex-shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-200">{wakeStatus}</span>
          </div>
        )}

        {!waking && wakeStatus && (
          <div className={`rounded-lg border p-4 flex items-center gap-3 ${
            wakeStatus.includes('готов') || wakeStatus.includes('работает')
              ? 'border-green-300 bg-green-50 dark:bg-green-950/50'
              : 'border-red-300 bg-red-50 dark:bg-red-950/50'
          }`}>
            <Icon
              name={wakeStatus.includes('готов') || wakeStatus.includes('работает') ? 'CheckCircle' : 'AlertCircle'}
              size={18}
              className={wakeStatus.includes('готов') || wakeStatus.includes('работает') ? 'text-green-600' : 'text-red-600'}
            />
            <span className="text-sm">{wakeStatus}</span>
          </div>
        )}

        {/* Task results summary */}
        {hasTasks && (
          <div className="rounded-lg border bg-white/60 dark:bg-gray-900/60 p-4 space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium">Прогресс:</span>
              {activeCount > 0 && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Icon name="Loader2" size={14} className="animate-spin" />
                  {activeCount} в обработке
                </span>
              )}
              {finishedCount > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <Icon name="CheckCircle" size={14} />
                  {finishedCount} готово
                </span>
              )}
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <Icon name="XCircle" size={14} />
                  {failedCount} ошибок
                </span>
              )}
              {failedCount > 0 && activeCount === 0 && (
                <button
                  onClick={retryAllFailed}
                  className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-sm ml-auto font-medium"
                >
                  <Icon name="RefreshCw" size={14} />
                  Повторить ошибки
                </button>
              )}
            </div>

            {/* Task list */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.task_id || task.photo_id}
                  className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded bg-white/50 dark:bg-gray-800/50"
                >
                  <span className="truncate flex-1 text-muted-foreground">
                    {task.file_name || `Фото #${task.photo_id}`}
                  </span>
                  <span className={`flex items-center gap-1 flex-shrink-0 ${statusColor(task.status)}`}>
                    {(task.status === 'queued' || task.status === 'started') && (
                      <Icon name="Loader2" size={12} className="animate-spin" />
                    )}
                    {task.status === 'finished' && <Icon name="CheckCircle" size={12} />}
                    {task.status === 'failed' && <Icon name="XCircle" size={12} />}
                    {statusLabel(task.status)}
                  </span>
                  {task.status === 'finished' && task.result_url && (
                    <a
                      href={task.result_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 flex-shrink-0"
                    >
                      <Icon name="Download" size={12} />
                      Скачать
                    </a>
                  )}
                  {task.status === 'failed' && (
                    <button
                      onClick={() => retryTask(task)}
                      className="flex items-center gap-1 text-amber-600 hover:text-amber-700 flex-shrink-0 text-xs"
                      title="Повторить ретушь"
                    >
                      <Icon name="RefreshCw" size={12} />
                      Повторить
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab selection - only show when no tasks are active */}
        {!hasTasks && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="text-sm">
                <Icon name="Image" size={14} className="mr-1.5" />
                Одно фото
              </TabsTrigger>
              <TabsTrigger value="all" className="text-sm">
                <Icon name="Images" size={14} className="mr-1.5" />
                Вся папка
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="mt-4">
              {loadingPhotos ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="Loader2" size={24} className="animate-spin mx-auto mb-2" />
                  Загрузка фото...
                </div>
              ) : photos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="ImageOff" size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">В папке нет фотографий</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Выберите фото для ретуши:
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => setSelectedPhotoId(photo.id)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 ${
                          selectedPhotoId === photo.id
                            ? 'border-rose-500 ring-2 ring-rose-300 shadow-lg'
                            : 'border-transparent hover:border-rose-200'
                        }`}
                      >
                        <img
                          src={getPhotoThumb(photo)}
                          alt={photo.file_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {selectedPhotoId === photo.id && (
                          <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                            <Icon name="Check" size={24} className="text-white drop-shadow-lg" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={handleRetouchSingle}
                      disabled={!selectedPhotoId || submitting || waking}
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      {submitting ? (
                        <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                      ) : (
                        <Icon name="Sparkles" size={16} className="mr-2" />
                      )}
                      Отретушировать
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="all" className="mt-4">
              {loadingPhotos ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="Loader2" size={24} className="animate-spin mx-auto mb-2" />
                  Загрузка...
                </div>
              ) : photos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="ImageOff" size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">В папке нет фотографий</p>
                </div>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30">
                    <Icon name="Images" size={32} className="text-rose-600" />
                  </div>
                  <div>
                    <p className="font-medium">Ретушь всей папки</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Будет обработано фото: {photos.length}
                    </p>
                  </div>
                  <Button
                    onClick={handleRetouchAll}
                    disabled={submitting || waking}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                    size="lg"
                  >
                    {submitting ? (
                      <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                    ) : (
                      <Icon name="Sparkles" size={16} className="mr-2" />
                    )}
                    {submitting ? 'Запуск ретуши...' : 'Отретушировать все фото'}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RetouchDialog;