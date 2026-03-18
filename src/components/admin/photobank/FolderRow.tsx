import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import type { PhotoFolder } from './types';

interface FolderRowProps {
  folder: PhotoFolder;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatDate: (date: string) => string;
  deleting: boolean;
  isSubfolder?: boolean;
}

const FolderRow = ({ folder, onClick, onDelete, formatDate, deleting, isSubfolder }: FolderRowProps) => {
  const folderTypeLabel: Record<string, { text: string; color: string }> = {
    'originals': { text: 'Оригиналы', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    'tech_rejects': { text: 'Тех. брак', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
    'retouch': { text: 'Ретушь', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  };
  const typeInfo = folder.folder_type ? folderTypeLabel[folder.folder_type] : null;

  return (
    <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border group" onClick={onClick}>
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${isSubfolder ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-orange-100 dark:bg-orange-950/50'}`}>
        <Icon name={isSubfolder ? 'FolderOpen' : 'Folder'} size={18} className={isSubfolder ? 'text-blue-600' : 'text-orange-600'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="font-medium text-xs sm:text-sm truncate">{folder.folder_name}</span>
          {typeInfo && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeInfo.color}`}>{typeInfo.text}</span>}
          {folder.is_hidden && <Icon name="EyeOff" size={12} className="text-muted-foreground" />}
          {folder.has_password && <Icon name="Lock" size={12} className="text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1"><Icon name="Image" size={12} />{folder.photo_count || 0}</span>
          <span>{formatDate(folder.created_at)}</span>
          {folder.s3_prefix && <span className="text-[10px] font-mono opacity-60 truncate max-w-[120px] sm:max-w-[200px] hidden sm:inline" title={folder.s3_prefix}>{folder.s3_prefix}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {(folder.archive_download_count ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 hidden sm:flex"><Icon name="Download" size={14} />{folder.archive_download_count}</span>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all" onClick={onDelete} disabled={deleting} title="Удалить папку">
          {deleting ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Trash2" size={14} />}
        </Button>
        <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
      </div>
    </div>
  );
};

export default FolderRow;
