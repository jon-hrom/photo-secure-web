import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { TrashedFolder } from './types';

interface TrashedFoldersListProps {
  folders: TrashedFolder[];
  loading: boolean;
  restoring: number | null;
  onRestore: (folderId: number, folderName: string) => void;
  getDaysLeftBadge: (dateStr: string) => { days: number; variant: string; text: string };
  formatDate: (dateStr: string) => string;
}

const TrashedFoldersList = ({
  folders,
  loading,
  restoring,
  onRestore,
  getDaysLeftBadge,
  formatDate
}: TrashedFoldersListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Trash2" size={20} />
          Удаленные папки ({folders.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && folders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="Loader2" size={32} className="animate-spin mx-auto mb-2" />
            Загрузка...
          </div>
        ) : folders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="FolderOpen" size={48} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Нет удаленных папок</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="p-3 rounded-lg border-2 border-muted hover:border-muted-foreground/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="Folder" size={16} className="text-muted-foreground shrink-0" />
                      <p className="font-medium text-sm truncate">{folder.folder_name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {folder.photo_count || 0} фото
                      </Badge>
                      <Badge 
                        variant={getDaysLeftBadge(folder.trashed_at).variant as any}
                        className="text-xs"
                      >
                        <Icon name="Clock" size={12} className="mr-1" />
                        {getDaysLeftBadge(folder.trashed_at).text}
                      </Badge>
                      <span className="truncate">{formatDate(folder.trashed_at)}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestore(folder.id, folder.folder_name)}
                    disabled={restoring === folder.id}
                  >
                    {restoring === folder.id ? (
                      <Icon name="Loader2" size={14} className="animate-spin mr-2" />
                    ) : (
                      <Icon name="Undo2" size={14} className="mr-2" />
                    )}
                    Восстановить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrashedFoldersList;