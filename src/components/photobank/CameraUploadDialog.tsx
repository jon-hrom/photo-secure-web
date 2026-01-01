import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { useCameraUploadLogic } from './camera-upload/CameraUploadLogic';
import CameraUploadFileList from './camera-upload/CameraUploadFileList';
import { 
  FileUploadStatus, 
  CameraUploadDialogProps 
} from './camera-upload/CameraUploadTypes';
import exifr from 'exifr';

const CameraUploadDialog = ({ open, onOpenChange, userId, folders, onUploadComplete }: CameraUploadDialogProps) => {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [folderMode, setFolderMode] = useState<'new' | 'existing'>('new');
  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<FileUploadStatus[]>([]);

  const {
    isOnline,
    retryFailedUploads,
    handleUploadProcess,
    abortControllersRef
  } = useCameraUploadLogic(userId, uploading, setFiles, filesRef, setUploading);

  useEffect(() => {
    if (open) {
      const now = new Date();
      const defaultName = `Загрузка ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      setFolderName(defaultName);
      setFolderMode('new');
      setSelectedFolderId(null);
      setSelectedDate(null);
      setAvailableDates([]);
    }
  }, [open]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newFilesPromises = selectedFiles.map(async (file) => {
      let captureDate: Date | undefined;
      try {
        const exifData = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] });
        if (exifData?.DateTimeOriginal) {
          captureDate = new Date(exifData.DateTimeOriginal);
        } else if (exifData?.CreateDate) {
          captureDate = new Date(exifData.CreateDate);
        }
      } catch (err) {
        captureDate = new Date(file.lastModified);
      }

      if (!captureDate || isNaN(captureDate.getTime())) {
        captureDate = new Date(file.lastModified);
      }

      return {
        file,
        status: 'pending' as const,
        progress: 0,
        captureDate,
        selected: false,
      };
    });

    const newFiles = await Promise.all(newFilesPromises);

    setFiles(prev => {
      const updated = [...prev, ...newFiles];
      filesRef.current = updated;

      const dates = new Set<string>();
      updated.forEach(f => {
        if (f.captureDate) {
          const dateStr = f.captureDate.toLocaleDateString('ru-RU');
          dates.add(dateStr);
        }
      });
      setAvailableDates(Array.from(dates).sort());

      return updated;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Выберите файлы для загрузки');
      return;
    }

    if (!selectedDate) {
      toast.error('Выберите дату съёмки для фильтрации');
      return;
    }

    if (folderMode === 'new' && !folderName.trim()) {
      toast.error('Введите название папки');
      return;
    }

    if (folderMode === 'existing' && !selectedFolderId) {
      toast.error('Выберите папку');
      return;
    }

    const filesToUpload = files.filter(f => {
      if (!f.captureDate) return false;
      const dateStr = f.captureDate.toLocaleDateString('ru-RU');
      return dateStr === selectedDate;
    });

    if (filesToUpload.length === 0) {
      toast.error('Нет файлов с выбранной датой съёмки');
      return;
    }

    setFiles(prev => {
      const updated = prev.map(f => {
        const dateStr = f.captureDate?.toLocaleDateString('ru-RU');
        if (dateStr === selectedDate && f.status === 'pending') {
          return f;
        }
        return { ...f, status: 'skipped' as const };
      });
      filesRef.current = updated;
      return updated;
    });

    console.log('[CAMERA_UPLOAD] Starting upload with', files.length, 'files');
    setUploading(true);

    await handleUploadProcess(
      folderMode,
      folderName,
      selectedFolderId,
      onUploadComplete,
      onOpenChange
    );
  };

  const handleCancel = () => {
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();
    setFiles([]);
    setUploading(false);
    onOpenChange(false);
  };

  const totalFiles = files.length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const selectedCount = files.filter(f => f.selected).length;
  const skippedCount = files.filter(f => f.status === 'skipped').length;
  const filteredCount = selectedDate ? files.filter(f => {
    const dateStr = f.captureDate?.toLocaleDateString('ru-RU');
    return dateStr === selectedDate;
  }).length : 0;

  const handleSelectAll = () => {
    setFiles(prev => {
      const updated = prev.map(f => ({ ...f, selected: true }));
      filesRef.current = updated;
      return updated;
    });
  };

  const handleDeselectAll = () => {
    setFiles(prev => {
      const updated = prev.map(f => ({ ...f, selected: false }));
      filesRef.current = updated;
      return updated;
    });
  };

  const handleToggleFile = (index: number) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      filesRef.current = updated;
      return updated;
    });
  };

  const handleDeleteSelected = () => {
    setFiles(prev => {
      const updated = prev.filter(f => !f.selected);
      filesRef.current = updated;
      return updated;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Camera" size={24} />
            Загрузить фото с камеры
            {!isOnline && (
              <span className="ml-auto flex items-center gap-1 text-sm font-normal text-destructive">
                <Icon name="WifiOff" size={16} />
                Нет сети
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">Выберите папку</label>
            <div className="flex gap-2">
              <Button
                variant={folderMode === 'new' ? 'default' : 'outline'}
                onClick={() => setFolderMode('new')}
                disabled={uploading}
                className="flex-1"
              >
                <Icon name="FolderPlus" size={18} className="mr-2" />
                Новая папка
              </Button>
              <Button
                variant={folderMode === 'existing' ? 'default' : 'outline'}
                onClick={() => setFolderMode('existing')}
                disabled={uploading || folders.length === 0}
                className="flex-1"
              >
                <Icon name="Folder" size={18} className="mr-2" />
                Существующая
              </Button>
            </div>

            {folderMode === 'new' ? (
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Введите название папки"
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground"
                disabled={uploading}
              />
            ) : (
              <select
                value={selectedFolderId || ''}
                onChange={(e) => setSelectedFolderId(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                disabled={uploading}
              >
                <option value="">Выберите папку...</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.folder_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {availableDates.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Icon name="Calendar" size={16} />
                Фильтр по дате съёмки
              </label>
              <select
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value || null)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                disabled={uploading}
              >
                <option value="">Выберите дату съёмки...</option>
                {availableDates.map(date => {
                  const count = files.filter(f => {
                    const dateStr = f.captureDate?.toLocaleDateString('ru-RU');
                    return dateStr === date;
                  }).length;
                  return (
                    <option key={date} value={date}>
                      {date} ({count} {count === 1 ? 'файл' : count < 5 ? 'файла' : 'файлов'})
                    </option>
                  );
                })}
              </select>
              {selectedDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="Info" size={14} />
                  Будет загружено {filteredCount} {filteredCount === 1 ? 'файл' : filteredCount < 5 ? 'файла' : 'файлов'} с датой {selectedDate}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.raw,.cr2,.nef,.arw,.dng"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
                disabled={uploading}
              >
                <Icon name="Images" size={18} className="mr-2" />
                Выбрать файлы
              </Button>
              <Button
                onClick={() => folderInputRef.current?.click()}
                variant="outline"
                className="w-full"
                disabled={uploading}
              >
                <Icon name="FolderOpen" size={18} className="mr-2" />
                Выбрать папку
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              💡 Для камеры используйте "Выбрать папку"
            </p>
          </div>

          <CameraUploadFileList
            files={files}
            totalFiles={totalFiles}
            successCount={successCount}
            errorCount={errorCount}
            pendingCount={pendingCount}
            selectedCount={selectedCount}
            skippedCount={skippedCount}
            onToggleFile={handleToggleFile}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDeleteSelected={handleDeleteSelected}
          />

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Icon name="Upload" size={18} className="mr-2" />
                  Загрузить ({files.length})
                </>
              )}
            </Button>
            {errorCount > 0 && !uploading && (
              <Button
                onClick={retryFailedUploads}
                variant="outline"
                className="flex-shrink-0"
              >
                <Icon name="RefreshCw" size={18} className="mr-2" />
                Повтор ({errorCount})
              </Button>
            )}
            <Button
              onClick={handleCancel}
              variant="outline"
            >
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraUploadDialog;