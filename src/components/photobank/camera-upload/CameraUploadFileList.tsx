import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { FileUploadStatus, MAX_RETRIES } from './CameraUploadTypes';

interface CameraUploadFileListProps {
  files: FileUploadStatus[];
  totalFiles: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  selectedCount: number;
  onToggleFile: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
}

interface FileGroup {
  date: string;
  files: { file: FileUploadStatus; index: number }[];
}

const CameraUploadFileList = ({
  files,
  totalFiles,
  successCount,
  errorCount,
  pendingCount,
  selectedCount,
  onToggleFile,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
}: CameraUploadFileListProps) => {
  if (totalFiles === 0) return null;

  const groupFilesByDate = (files: FileUploadStatus[]): FileGroup[] => {
    const groups = new Map<string, { file: FileUploadStatus; index: number }[]>();

    files.forEach((file, index) => {
      const date = file.captureDate || new Date(file.file.lastModified);
      const dateKey = date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push({ file, index });
    });

    return Array.from(groups.entries())
      .map(([date, files]) => ({ date, files }))
      .sort((a, b) => {
        const dateA = a.files[0].file.captureDate || new Date(a.files[0].file.file.lastModified);
        const dateB = b.files[0].file.captureDate || new Date(b.files[0].file.file.lastModified);
        return dateB.getTime() - dateA.getTime();
      });
  };

  const fileGroups = groupFilesByDate(files);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Всего: {totalFiles}</span>
        <div className="flex gap-4">
          <span className="text-green-600">✓ {successCount}</span>
          <span className="text-red-600">✗ {errorCount}</span>
          <span className="text-gray-600">⏳ {pendingCount}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={selectedCount === totalFiles ? onDeselectAll : onSelectAll}
          className="flex-1"
        >
          <Icon name={selectedCount === totalFiles ? "Square" : "CheckSquare"} size={16} className="mr-2" />
          {selectedCount === totalFiles ? 'Снять выделение' : 'Выделить всё'}
        </Button>
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
          >
            <Icon name="Trash2" size={16} className="mr-2" />
            Удалить ({selectedCount})
          </Button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto space-y-3 border rounded-lg p-3">
        {fileGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-2">
            <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
              <Icon name="Calendar" size={16} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">{group.date}</span>
              <span className="text-xs text-muted-foreground">({group.files.length})</span>
            </div>
            <div className="space-y-2 pl-2">
              {group.files.map(({ file: fileStatus, index }) => (
                <div
                  key={index}
                  className={`space-y-1 p-2 rounded-lg border transition-colors cursor-pointer ${
                    fileStatus.selected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => onToggleFile(index)}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Icon
                        name={fileStatus.selected ? "CheckSquare" : "Square"}
                        size={18}
                        className={fileStatus.selected ? 'text-primary' : 'text-muted-foreground'}
                      />
                      <span className="truncate flex-1">{fileStatus.file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {fileStatus.status === 'success' && (
                        <Icon name="CheckCircle" size={16} className="text-green-600" />
                      )}
                      {fileStatus.status === 'error' && (
                        <Icon name="XCircle" size={16} className="text-red-600" />
                      )}
                      {fileStatus.status === 'uploading' && (
                        <Icon name="Loader2" size={16} className="animate-spin" />
                      )}
                      {fileStatus.status === 'retrying' && (
                        <Icon name="RefreshCw" size={16} className="animate-spin text-orange-500" />
                      )}
                    </div>
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
        ))}
      </div>
    </div>
  );
};

export default CameraUploadFileList;
