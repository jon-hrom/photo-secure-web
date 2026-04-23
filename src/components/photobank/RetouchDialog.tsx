import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useRetouch } from '@/contexts/RetouchContext';
import RetouchWakeStatus from './RetouchWakeStatus';
import RetouchTaskList from './RetouchTaskList';
import RetouchPhotoSelector from './RetouchPhotoSelector';
import RetouchSettings from './RetouchSettings';
import { getPhotoPreviewUrl, Photo as RetouchPhoto } from './retouchTypes';

const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';
const RETOUCH_API = 'https://functions.poehali.dev/c95989eb-d7f0-4fac-b9c9-f8ab0fb61aff';

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
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const [maskLoading, setMaskLoading] = useState(false);
  const [maskOpacity, setMaskOpacity] = useState(60);
  const [maskOnly, setMaskOnly] = useState(false);
  const maskCacheRef = useRef<Map<number, string>>(new Map());
  const hasActiveWorkRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const hasActiveTasks = tasks.some(t => t.status === 'queued' || t.status === 'started' || t.status === 'processing');
    hasActiveWorkRef.current = isProcessing || hasActiveTasks || minimized;
  }, [isProcessing, tasks, minimized]);

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
    if (!newOpen) {
      if (isProcessing) {
        setShowConfirm(true);
        return;
      }
      if (hasActiveWorkRef.current) {
        setMinimized(true);
      } else {
        fullClose();
      }
      onOpenChange(false);
    }
  };

  const handleConfirmStop = () => {
    setShowConfirm(false);
    fullClose();
    onOpenChange(false);
  };

  const handleConfirmMinimize = () => {
    setShowConfirm(false);
    setMinimized(true);
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
  const allDone = hasTasks && tasks.every(t => t.status === 'finished' || t.status === 'failed') && !isProcessing;

  const handleNewRetouch = () => {
    startSession({ folderId, folderName, userId, onRetouchComplete });
  };

  const selectedPhoto = photos.find(p => p.id === selectedPhotoId) || null;

  useEffect(() => {
    if (!showMask || !selectedPhotoId) {
      setMaskUrl(null);
      setMaskLoading(false);
      return;
    }
    const cached = maskCacheRef.current.get(selectedPhotoId);
    if (cached) {
      setMaskUrl(cached);
      return;
    }
    let cancelled = false;
    setMaskLoading(true);
    setMaskUrl(null);
    (async () => {
      try {
        const res = await fetch(
          `${RETOUCH_API}?action=preview_mask&photo_id=${selectedPhotoId}`,
          { headers: { 'X-User-Id': userId } }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Не удалось построить маску');
        }
        const data = await res.json();
        if (cancelled || !data.mask_b64) return;
        const dataUrl = `data:image/png;base64,${data.mask_b64}`;
        maskCacheRef.current.set(selectedPhotoId, dataUrl);
        setMaskUrl(dataUrl);
      } catch (e) {
        if (!cancelled) {
          toast({
            title: 'Не удалось показать маску',
            description: e instanceof Error ? e.message : 'Ошибка',
            variant: 'destructive',
          });
          setShowMask(false);
        }
      } finally {
        if (!cancelled) setMaskLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showMask, selectedPhotoId, userId, toast]);

  if (minimized) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className={`${showSettings ? 'max-w-5xl' : 'max-w-2xl'} w-[calc(100%-1rem)] sm:w-full max-h-[92vh] sm:max-h-[85vh] overflow-y-auto bg-gradient-to-br from-rose-50/80 via-pink-50/60 to-purple-50/80 dark:from-rose-950/80 dark:via-pink-950/60 dark:to-purple-950/80 backdrop-blur-sm rounded-2xl sm:rounded-xl p-4 sm:p-6 transition-all duration-300`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="Sparkles" size={18} className="text-rose-600" />
            Ретушь фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Папка: {folderName}
          </DialogDescription>
        </DialogHeader>

        {showSettings ? (
          <RetouchSettings
            userId={userId}
            onBack={() => setShowSettings(false)}
            previewPhoto={photos.find(p => p.id === selectedPhotoId) || photos[0] || null}
            photos={photos}
          />
        ) : (
          <>
            {!hasTasks && (
              <div className="flex items-center gap-2 flex-wrap -mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSettings(true)}
                >
                  <Icon name="SlidersHorizontal" size={14} className="mr-1" />
                  Настройки ретуши
                </Button>
                <label
                  className={`flex items-center gap-1.5 text-xs select-none px-2 py-1 rounded-md transition-colors ${
                    selectedPhotoId
                      ? 'text-muted-foreground hover:text-foreground cursor-pointer hover:bg-rose-100/50 dark:hover:bg-rose-900/20'
                      : 'text-muted-foreground/50 cursor-not-allowed'
                  }`}
                  title={selectedPhotoId ? 'Посмотреть маску кожи на выбранном фото' : 'Сначала выберите фото'}
                >
                  <input
                    type="checkbox"
                    className="accent-rose-500"
                    checked={showMask}
                    disabled={!selectedPhotoId}
                    onChange={(e) => setShowMask(e.target.checked)}
                  />
                  <Icon name="ScanFace" size={14} />
                  Показать маску
                </label>
              </div>
            )}

            <RetouchWakeStatus waking={waking} wakeStatus={wakeStatus} />

            {hasTasks && (
              <>
                <RetouchTaskList
                  tasks={tasks}
                  onRetryTask={retryTask}
                  onRetryAllFailed={retryAllFailed}
                />
                {allDone && (
                  <Button
                    onClick={handleNewRetouch}
                    variant="outline"
                    className="w-full mt-2"
                  >
                    <Icon name="Plus" size={16} className="mr-2" />
                    Обработать ещё
                  </Button>
                )}
              </>
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
          </>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={showMask && !!selectedPhoto} onOpenChange={(v) => { if (!v) setShowMask(false); }}>
      <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-5xl max-h-[95vh] p-0 overflow-hidden bg-black border-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Маска кожи</DialogTitle>
          <DialogDescription>Предпросмотр автоматической маски лица</DialogDescription>
        </DialogHeader>
        {selectedPhoto && (
          <div className="relative w-full h-[90vh] flex items-center justify-center bg-[#0a0a0a]">
            {!maskOnly && (
              <img
                src={getPhotoPreviewUrl(selectedPhoto as RetouchPhoto)}
                alt={selectedPhoto.file_name}
                className="absolute inset-0 w-full h-full object-contain"
                draggable={false}
              />
            )}
            {maskUrl && (
              <div
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  opacity: maskOpacity / 100,
                  backgroundColor: '#ff2d6f',
                  WebkitMaskImage: `url(${maskUrl})`,
                  maskImage: `url(${maskUrl})`,
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskMode: 'alpha',
                  maskMode: 'alpha',
                } as React.CSSProperties}
              />
            )}
            {maskLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="flex items-center gap-2 text-white text-sm bg-black/60 rounded-full px-4 py-2">
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  Строю маску...
                </div>
              </div>
            )}
            <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Icon name="ScanFace" size={14} />
              Маска кожи
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-full px-4 py-2.5 flex items-center gap-3 sm:gap-4 text-white text-xs shadow-lg">
              <div className="flex items-center gap-2 min-w-[160px] sm:min-w-[220px]">
                <Icon name="Droplet" size={14} className="opacity-80" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={maskOpacity}
                  onChange={(e) => setMaskOpacity(Number(e.target.value))}
                  className="flex-1 accent-rose-500 cursor-pointer"
                />
                <span className="tabular-nums w-8 text-right">{maskOpacity}%</span>
              </div>
              <div className="w-px h-5 bg-white/20" />
              <button
                onClick={() => setMaskOnly(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
                  maskOnly ? 'bg-rose-500 text-white' : 'hover:bg-white/10'
                }`}
                title="Показать только маску без фото"
              >
                <Icon name={maskOnly ? 'EyeOff' : 'Eye'} size={13} />
                <span className="hidden sm:inline">{maskOnly ? 'Только маска' : 'С фото'}</span>
              </button>
              <button
                onClick={() => {
                  if (!selectedPhotoId) return;
                  maskCacheRef.current.delete(selectedPhotoId);
                  setMaskUrl(null);
                  setShowMask(false);
                  setTimeout(() => setShowMask(true), 50);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors"
                title="Перестроить маску с сервера"
              >
                <Icon name="RefreshCw" size={13} />
                <span className="hidden sm:inline">Обновить</span>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm rounded-2xl sm:rounded-xl p-5 sm:p-6">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Icon name="AlertTriangle" size={24} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1.5">
            <DialogHeader className="p-0">
              <DialogTitle className="font-semibold text-base sm:text-lg text-foreground">Остановить обработку?</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1.5">
                Оставшиеся фото не будут обработаны. Все фотографии, которые уже прошли ретушь, сохранены и доступны в вашей папке.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full mt-1">
            <Button
              variant="outline"
              onClick={handleConfirmMinimize}
              className="h-11 sm:h-10 text-sm flex-1"
            >
              Свернуть
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmStop}
              className="h-11 sm:h-10 text-sm flex-1"
            >
              Остановить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default RetouchDialog;