import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const MOBILE_UPLOAD_API = 'https://functions.poehali.dev/3372b3ed-5509-41e0-a542-b3774be6b702';
const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/6ebe8c65-0cda-4cbf-a49e-f9beb7e5da5a';
const MAX_CONCURRENT_UPLOADS = 3;

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  s3_key?: string;
}

interface CameraUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onUploadComplete?: () => void;
}

const CameraUploadDialog = ({ open, onOpenChange, userId, onUploadComplete }: CameraUploadDialogProps) => {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [folderName, setFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    if (open) {
      const now = new Date();
      const defaultName = `Загрузка ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      setFolderName(defaultName);
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

    setFiles(prev => [...prev, ...newFiles]);
  };

  const uploadFile = async (fileStatus: FileUploadStatus): Promise<void> => {
    const { file } = fileStatus;
    const abortController = new AbortController();
    abortControllersRef.current.set(file.name, abortController);

    try {
      setFiles(prev => prev.map(f => 
        f.file.name === file.name ? { ...f, status: 'uploading', progress: 0 } : f
      ));

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
          setFiles(prev => prev.map(f => 
            f.file.name === file.name ? { ...f, progress } : f
          ));
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

      setFiles(prev => prev.map(f => 
        f.file.name === file.name 
          ? { ...f, status: 'success', progress: 100, s3_key: key } 
          : f
      ));

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setFiles(prev => prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: 'error', error: 'Отменено' } 
            : f
        ));
      } else {
        setFiles(prev => prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: 'error', error: error.message } 
            : f
        ));
      }
    } finally {
      abortControllersRef.current.delete(file.name);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Выберите файлы для загрузки');
      return;
    }

    if (!folderName.trim()) {
      toast.error('Введите название папки');
      return;
    }

    setUploading(true);

    try {
      const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
      
      for (let i = 0; i < pendingFiles.length; i += MAX_CONCURRENT_UPLOADS) {
        const batch = pendingFiles.slice(i, i + MAX_CONCURRENT_UPLOADS);
        await Promise.all(batch.map(uploadFile));
      }

      const successfulUploads = files.filter(f => f.status === 'success');

      if (successfulUploads.length > 0) {
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
          throw new Error('Не удалось создать папку');
        }

        const { folder } = await createFolderResponse.json();

        for (const fileStatus of successfulUploads) {
          if (fileStatus.s3_key) {
            const s3Url = `https://storage.yandexcloud.net/foto-mix/${fileStatus.s3_key}`;
            
            await fetch(PHOTOBANK_FOLDERS_API, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId,
              },
              body: JSON.stringify({
                action: 'upload_photo',
                folder_id: folder.id,
                file_name: fileStatus.file.name,
                s3_url: s3Url,
                file_size: fileStatus.file.size,
              }),
            });
          }
        }

        toast.success(`Загружено ${successfulUploads.length} файлов в папку "${folderName}"`);
        
        if (onUploadComplete) {
          onUploadComplete();
        }

        setFiles([]);
        onOpenChange(false);
      }

    } catch (error: any) {
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
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Название папки</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Введите название папки"
              className="w-full px-3 py-2 border rounded-lg"
              disabled={uploading}
            />
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.raw,.cr2,.nef,.arw,.dng"
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
                    </div>
                    {fileStatus.status === 'uploading' && (
                      <Progress value={fileStatus.progress} className="h-1" />
                    )}
                    {fileStatus.error && (
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