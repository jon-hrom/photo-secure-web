import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useFastUploadLogic } from './camera-upload/FastUploadLogic';
import { FileUploadStatus } from './camera-upload/CameraUploadTypes';
import Icon from '@/components/ui/icon';

interface FastUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onUploadComplete?: () => void;
}

const FastUploadDialog = ({ open, onOpenChange, userId, onUploadComplete }: FastUploadDialogProps) => {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<FileUploadStatus[]>([]);

  const { uploadFilesOptimized, uploadStats, cancelUpload } = useFastUploadLogic(userId, setFiles, filesRef);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newFiles: FileUploadStatus[] = selectedFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
      captureDate: new Date(file.lastModified),
      selected: false
    }));

    setFiles(prev => {
      const updated = [...prev, ...newFiles];
      filesRef.current = updated;
      return updated;
    });

    toast.success(`Выбрано файлов: ${selectedFiles.length}`);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Выберите файлы для загрузки');
      return;
    }

    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) {
      toast.info('Все файлы уже загружены');
      return;
    }

    setUploading(true);
    await uploadFilesOptimized(pendingFiles);
    setUploading(false);

    const successCount = filesRef.current.filter(f => f.status === 'success').length;
    const errorCount = filesRef.current.filter(f => f.status === 'error').length;

    if (errorCount === 0) {
      toast.success(`Загружено ${successCount} файлов`);
      if (onUploadComplete) onUploadComplete();
      onOpenChange(false);
    } else {
      toast.warning(`Загружено ${successCount}, ошибок: ${errorCount}`);
    }
  };

  const handleCancel = () => {
    cancelUpload();
    setUploading(false);
    toast.success('Загрузка прервана');
  };

  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
  const uploadedSize = files
    .filter(f => f.status === 'success')
    .reduce((sum, f) => sum + f.file.size, 0);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    return `${formatBytes(bytesPerSec)}/с`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}с`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}м ${secs}с`;
  };

  const overallProgress = files.length > 0 
    ? (successCount / files.length) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Быстрая загрузка файлов</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* File Selection */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              variant="outline"
            >
              <Icon name="Upload" className="mr-2" />
              Выбрать файлы
            </Button>
            {files.length > 0 && (
              <Button
                onClick={() => {
                  setFiles([]);
                  filesRef.current = [];
                }}
                disabled={uploading}
                variant="outline"
              >
                <Icon name="Trash2" className="mr-2" />
                Очистить
              </Button>
            )}
          </div>

          {/* Upload Stats */}
          {files.length > 0 && (
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Прогресс:</span>
                <span className="font-medium">
                  {successCount} / {files.length} файлов
                </span>
              </div>
              
              <Progress value={overallProgress} className="h-2" />
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Размер:</span>
                  <span className="ml-2 font-medium">
                    {formatBytes(uploadedSize)} / {formatBytes(totalSize)}
                  </span>
                </div>
                {uploading && uploadStats.uploadSpeed > 0 && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Скорость:</span>
                      <span className="ml-2 font-medium">
                        {formatSpeed(uploadStats.uploadSpeed)}
                      </span>
                    </div>
                    {uploadStats.estimatedTimeRemaining > 0 && (
                      <div>
                        <span className="text-muted-foreground">Осталось:</span>
                        <span className="ml-2 font-medium">
                          {formatTime(uploadStats.estimatedTimeRemaining)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {errorCount > 0 && (
                  <div className="text-destructive">
                    <Icon name="AlertCircle" className="inline mr-1" size={14} />
                    Ошибок: {errorCount}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* File List (simplified) */}
          {files.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {files.map((fileStatus, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {fileStatus.status === 'success' && (
                      <Icon name="CheckCircle2" className="text-green-500 flex-shrink-0" size={16} />
                    )}
                    {fileStatus.status === 'error' && (
                      <Icon name="XCircle" className="text-destructive flex-shrink-0" size={16} />
                    )}
                    {fileStatus.status === 'uploading' && (
                      <Icon name="Loader2" className="animate-spin flex-shrink-0" size={16} />
                    )}
                    {fileStatus.status === 'pending' && (
                      <Icon name="Clock" className="text-muted-foreground flex-shrink-0" size={16} />
                    )}
                    <span className="truncate">{fileStatus.file.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(fileStatus.file.size)}
                    </span>
                    {fileStatus.status === 'uploading' && (
                      <span className="text-xs font-medium">
                        {fileStatus.progress.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {files.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Icon name="Upload" className="mx-auto mb-4" size={48} />
              <p>Выберите файлы для загрузки</p>
              <p className="text-sm mt-2">Поддерживается массовая загрузка</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={uploading}
          >
            {uploading ? 'Закрыть после загрузки' : 'Отмена'}
          </Button>
          {uploading ? (
            <Button onClick={handleCancel} variant="destructive">
              <Icon name="X" className="mr-2" />
              Прервать загрузку
            </Button>
          ) : (
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || successCount === files.length}
            >
              <Icon name="Upload" className="mr-2" />
              Загрузить {files.length > 0 ? `(${files.length})` : ''}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FastUploadDialog;
