import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const MOBILE_UPLOAD_API = 'https://functions.poehali.dev/3372b3ed-5509-41e0-a542-b3774be6b702';
const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';
const MAX_CONCURRENT_UPLOADS = 3;

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'retrying';
  progress: number;
  error?: string;
  s3_key?: string;
  retryCount?: number;
}

interface PhotoFolder {
  id: number;
  folder_name: string;
}

interface CameraUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  folders: PhotoFolder[];
  onUploadComplete?: () => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const CameraUploadDialog = ({ open, onOpenChange, userId, folders, onUploadComplete }: CameraUploadDialogProps) => {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [folderMode, setFolderMode] = useState<'new' | 'existing'>('new');
  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const filesRef = useRef<FileUploadStatus[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[CAMERA_UPLOAD] Network online');
      setIsOnline(true);
      if (uploading && filesRef.current.some(f => f.status === 'error')) {
        toast.info('Интернет восстановлен, продолжаем загрузку...');
        retryFailedUploads();
      }
    };
    
    const handleOffline = () => {
      console.log('[CAMERA_UPLOAD] Network offline');
      setIsOnline(false);
      toast.error('Нет интернета. Загрузка возобновится автоматически.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [uploading]);

  useEffect(() => {
    if (open) {
      const now = new Date();
      const defaultName = `Загрузка ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      setFolderName(defaultName);
      setFolderMode('new');
      setSelectedFolderId(null);
    }
  }, [open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newFiles: FileUploadStatus[] = selectedFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => {
      const updated = [...prev, ...newFiles];
      filesRef.current = updated;
      return updated;
    });
  };

  const uploadFile = async (fileStatus: FileUploadStatus, retryAttempt: number = 0): Promise<void> => {
    const { file } = fileStatus;
    const abortController = new AbortController();
    abortControllersRef.current.set(file.name, abortController);

    try {
      setFiles(prev => {
        const updated = prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: retryAttempt > 0 ? 'retrying' : 'uploading', progress: 0, retryCount: retryAttempt } 
            : f
        );
        filesRef.current = updated;
        return updated;
      });

      if (!navigator.onLine) {
        throw new Error('Нет подключения к интернету');
      }

      const urlResponse = await fetch(
        `${MOBILE_UPLOAD_API}?action=get-url&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
        {
          headers: { 'X-User-Id': userId },
          signal: abortController.signal,
        }
      );

      if (!urlResponse.ok) throw new Error('Failed to get upload URL');
      
      const { url, key } = await urlResponse.json();

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setFiles(prev => {
            const updated = prev.map(f => 
              f.file.name === file.name ? { ...f, progress } : f
            );
            filesRef.current = updated;
            return updated;
          });
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      await fetch(MOBILE_UPLOAD_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          action: 'confirm',
          s3_key: key,
          orig_filename: file.name,
          size_bytes: file.size,
          content_type: file.type,
        }),
      });

      setFiles(prev => {
        const updated = prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: 'success', progress: 100, s3_key: key } 
            : f
        );
        filesRef.current = updated;
        return updated;
      });

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setFiles(prev => {
          const updated = prev.map(f => 
            f.file.name === file.name 
              ? { ...f, status: 'error', error: 'Отменено' } 
              : f
          );
          filesRef.current = updated;
          return updated;
        });
      } else {
        const isNetworkError = error.message.includes('Network') || 
                               error.message.includes('интернет') || 
                               !navigator.onLine;
        
        if (isNetworkError && retryAttempt < MAX_RETRIES) {
          console.log(`[CAMERA_UPLOAD] Retry ${retryAttempt + 1}/${MAX_RETRIES} for ${file.name}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          await uploadFile(fileStatus, retryAttempt + 1);
        } else {
          setFiles(prev => {
            const updated = prev.map(f => 
              f.file.name === file.name 
                ? { ...f, status: 'error', error: isNetworkError ? 'Ошибка сети' : error.message } 
                : f
            );
            filesRef.current = updated;
            return updated;
          });
        }
      }
    } finally {
      abortControllersRef.current.delete(file.name);
    }
  };

  const retryFailedUploads = async () => {
    const failedFiles = filesRef.current.filter(f => f.status === 'error');
    if (failedFiles.length === 0) return;

    console.log('[CAMERA_UPLOAD] Retrying failed uploads:', failedFiles.length);
    
    for (let i = 0; i < failedFiles.length; i += MAX_CONCURRENT_UPLOADS) {
      const batch = failedFiles.slice(i, i + MAX_CONCURRENT_UPLOADS);
      await Promise.all(batch.map(f => uploadFile(f)));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Выберите файлы для загрузки');
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

    console.log('[CAMERA_UPLOAD] Starting upload with', files.length, 'files');
    setUploading(true);

    try {
      const pendingFiles = filesRef.current.filter(f => f.status === 'pending' || f.status === 'error');
      console.log('[CAMERA_UPLOAD] Pending files to upload:', pendingFiles.length);
      
      for (let i = 0; i < pendingFiles.length; i += MAX_CONCURRENT_UPLOADS) {
        const batch = pendingFiles.slice(i, i + MAX_CONCURRENT_UPLOADS);
        await Promise.all(batch.map(uploadFile));
      }

      const successfulUploads = filesRef.current.filter(f => f.status === 'success');
      console.log('[CAMERA_UPLOAD] Successful uploads:', successfulUploads.length, successfulUploads);

      if (successfulUploads.length > 0) {
        let targetFolderId: number;

        if (folderMode === 'new') {
          console.log('[CAMERA_UPLOAD] Creating folder:', folderName.trim());
          const createFolderResponse = await fetch(PHOTOBANK_FOLDERS_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': userId,
            },
            body: JSON.stringify({
              action: 'create_folder',
              folder_name: folderName.trim(),
            }),
          });

          if (!createFolderResponse.ok) {
            const errorText = await createFolderResponse.text();
            console.error('[CAMERA_UPLOAD] Create folder error:', errorText);
            throw new Error('Не удалось создать папку');
          }

          const folderData = await createFolderResponse.json();
          console.log('[CAMERA_UPLOAD] Folder created:', folderData);
          targetFolderId = folderData.folder.id;
        } else {
          targetFolderId = selectedFolderId!;
        }

        console.log('[CAMERA_UPLOAD] Adding photos to folder:', targetFolderId);
        for (const fileStatus of successfulUploads) {
          if (fileStatus.s3_key) {
            const s3Url = `https://storage.yandexcloud.net/foto-mix/${fileStatus.s3_key}`;
            console.log('[CAMERA_UPLOAD] Adding photo:', fileStatus.file.name, 's3_key:', fileStatus.s3_key);
            
            const addPhotoResponse = await fetch(PHOTOBANK_FOLDERS_API, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId,
              },
              body: JSON.stringify({
                action: 'upload_photo',
                folder_id: targetFolderId,
                file_name: fileStatus.file.name,
                s3_url: s3Url,
                file_size: fileStatus.file.size,
              }),
            });

            if (!addPhotoResponse.ok) {
              const errorText = await addPhotoResponse.text();
              console.error('[CAMERA_UPLOAD] Add photo error:', errorText);
            } else {
              console.log('[CAMERA_UPLOAD] Photo added successfully:', fileStatus.file.name);
            }
          }
        }

        console.log('[CAMERA_UPLOAD] Upload complete!');
        toast.success(`Загружено ${successfulUploads.length} файлов в папку "${folderName}"`);
        
        if (onUploadComplete) {
          onUploadComplete();
        }

        setFiles([]);
        filesRef.current = [];
        onOpenChange(false);
      } else {
        console.log('[CAMERA_UPLOAD] No successful uploads');
        toast.error('Файлы не удалось загрузить');
      }

    } catch (error: any) {
      console.error('[CAMERA_UPLOAD] Upload error:', error);
      toast.error(`Ошибка: ${error.message}`);
    } finally {
      setUploading(false);
    }
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

          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.raw,.cr2,.nef,.arw,.dng"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full"
              disabled={uploading}
            >
              <Icon name="FolderOpen" size={18} className="mr-2" />
              Выбрать файлы
            </Button>
          </div>

          {totalFiles > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Всего: {totalFiles}</span>
                <div className="flex gap-4">
                  <span className="text-green-600">✓ {successCount}</span>
                  <span className="text-red-600">✗ {errorCount}</span>
                  <span className="text-gray-600">⏳ {pendingCount}</span>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
                {files.map((fileStatus, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">{fileStatus.file.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {fileStatus.status === 'success' && (
                        <Icon name="CheckCircle" size={16} className="text-green-600 ml-2" />
                      )}
                      {fileStatus.status === 'error' && (
                        <Icon name="XCircle" size={16} className="text-red-600 ml-2" />
                      )}
                      {fileStatus.status === 'uploading' && (
                        <Icon name="Loader2" size={16} className="animate-spin ml-2" />
                      )}
                      {fileStatus.status === 'retrying' && (
                        <Icon name="RefreshCw" size={16} className="animate-spin text-orange-500 ml-2" />
                      )}
                    </div>
                    {(fileStatus.status === 'uploading' || fileStatus.status === 'retrying') && (
                      <Progress value={fileStatus.progress} className="h-1" />
                    )}
                    {fileStatus.status === 'retrying' && fileStatus.retryCount !== undefined && (
                      <p className="text-xs text-orange-500">
                        Повторная попытка {fileStatus.retryCount + 1}/{MAX_RETRIES + 1}
                      </p>
                    )}
                    {fileStatus.error && fileStatus.status === 'error' && (
                      <p className="text-xs text-red-600">{fileStatus.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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