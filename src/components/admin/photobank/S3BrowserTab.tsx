import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { S3Folder, S3File } from './types';
import { formatBytes, isPreviewable, isRawFile, isVideoFile } from './types';

interface S3BrowserTabProps {
  s3Folders: S3Folder[];
  s3Files: S3File[];
  s3Prefix: string;
  s3Bucket: string;
  s3Loading: boolean;
  s3History: string[];
  uploading: boolean;
  onNavigate: (prefix: string) => void;
  onNavigateBack: () => void;
  onViewFile: (file: S3File) => void;
  onBreadcrumbClick: (prefix: string) => void;
  onUploadFiles: (files: FileList) => void;
}

const S3BrowserTab = ({
  s3Folders,
  s3Files,
  s3Prefix,
  s3Bucket,
  s3Loading,
  s3History,
  uploading,
  onNavigate,
  onNavigateBack,
  onViewFile,
  onBreadcrumbClick,
  onUploadFiles,
}: S3BrowserTabProps) => {
  const s3Breadcrumbs = s3Prefix.split('/').filter(Boolean);

  const formatS3Date = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="px-3 sm:px-4 py-1.5 border-b bg-gray-950/5 dark:bg-gray-50/5">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-mono overflow-x-auto whitespace-nowrap flex-1 min-w-0">
            <span className="text-muted-foreground shrink-0">{s3Bucket || 'foto-mix'}</span>
            {s3Breadcrumbs.map((segment, i) => (
              <span key={i} className="flex items-center gap-1.5 shrink-0">
                <Icon name="ChevronRight" size={12} className="text-muted-foreground" />
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    const newPrefix = s3Breadcrumbs.slice(0, i + 1).join('/') + '/';
                    onBreadcrumbClick(newPrefix);
                  }}
                >
                  {segment}
                </button>
              </span>
            ))}
          </div>
          <label className="shrink-0">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onUploadFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              disabled={uploading}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 cursor-pointer"
              disabled={uploading}
              asChild
            >
              <span>
                <Icon name={uploading ? "Loader2" : "Upload"} size={14} className={uploading ? "animate-spin" : ""} />
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </span>
            </Button>
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {s3Loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b bg-muted/50 sticky top-0 z-10">
                <th className="text-left px-2.5 sm:px-4 py-1.5 font-medium text-muted-foreground text-xs">Имя</th>
                <th className="text-right px-2.5 sm:px-4 py-1.5 font-medium text-muted-foreground text-xs w-20 sm:w-28 hidden sm:table-cell">Размер</th>
                <th className="text-left px-4 py-1.5 font-medium text-muted-foreground text-xs w-32 hidden lg:table-cell">Класс</th>
                <th className="text-left px-4 py-1.5 font-medium text-muted-foreground text-xs w-40 hidden md:table-cell">Изменено</th>
              </tr>
            </thead>
            <tbody>
              {s3History.length > 0 && (
                <tr className="border-b hover:bg-accent/50 cursor-pointer transition-colors" onClick={onNavigateBack}>
                  <td className="px-4 py-1.5" colSpan={4}>
                    <div className="flex items-center gap-2 text-blue-600">
                      <Icon name="CornerLeftUp" size={16} />
                      <span>..</span>
                    </div>
                  </td>
                </tr>
              )}
              {s3Folders.map((folder) => (
                <tr key={folder.prefix} className="border-b hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => onNavigate(folder.prefix)}>
                  <td className="px-2.5 sm:px-4 py-1.5">
                    <div className="flex items-center gap-2">
                      <Icon name="Folder" size={18} className="text-yellow-500 shrink-0" />
                      <span className="text-blue-600 hover:underline truncate">{folder.name}/</span>
                    </div>
                  </td>
                  <td className="px-2.5 sm:px-4 py-1.5 text-right text-muted-foreground hidden sm:table-cell">—</td>
                  <td className="px-4 py-1.5 text-muted-foreground hidden lg:table-cell">—</td>
                  <td className="px-4 py-1.5 text-muted-foreground hidden md:table-cell">—</td>
                </tr>
              ))}
              {s3Files.map((file) => (
                <tr key={file.key} className="border-b hover:bg-accent/30 transition-colors group/row">
                  <td className="px-2.5 sm:px-4 py-1.5">
                    <div className="flex items-center gap-2">
                      <Icon
                        name={isPreviewable(file.name) || isRawFile(file.name) ? 'Image' : isVideoFile(file.name) ? 'Film' : 'File'}
                        size={18}
                        className="text-gray-400 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="truncate block" title={file.key}>{file.name}</span>
                        <span className="text-[10px] text-muted-foreground sm:hidden">{formatBytes(file.size)}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
                        onClick={() => onViewFile(file)}
                        title={isPreviewable(file.name) ? 'Просмотр' : 'Скачать / Открыть'}
                      >
                        <Icon name={isPreviewable(file.name) || isVideoFile(file.name) ? 'Eye' : 'ExternalLink'} size={15} />
                      </Button>
                    </div>
                  </td>
                  <td className="px-2.5 sm:px-4 py-1.5 text-right text-muted-foreground whitespace-nowrap hidden sm:table-cell">{formatBytes(file.size)}</td>
                  <td className="px-4 py-1.5 text-muted-foreground hidden lg:table-cell">{file.storage_class === 'STANDARD' ? 'Стандартное' : file.storage_class}</td>
                  <td className="px-4 py-1.5 text-muted-foreground whitespace-nowrap hidden md:table-cell">{formatS3Date(file.last_modified)}</td>
                </tr>
              ))}
              {s3Folders.length === 0 && s3Files.length === 0 && !s3Loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    <Icon name="FolderOpen" size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Пустая директория</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

export default S3BrowserTab;