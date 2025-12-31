import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { FileUploadStatus, MAX_RETRIES } from './CameraUploadTypes';

interface CameraUploadFileListProps {
  files: FileUploadStatus[];
  totalFiles: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
}

const CameraUploadFileList = ({
  files,
  totalFiles,
  successCount,
  errorCount,
  pendingCount
}: CameraUploadFileListProps) => {
  if (totalFiles === 0) return null;

  return (
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
  );
};

export default CameraUploadFileList;
