import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface PhotoBankFoldersListProps {
  folders: PhotoFolder[];
  selectedFolder: PhotoFolder | null;
  loading: boolean;
  onSelectFolder: (folder: PhotoFolder) => void;
  onDeleteFolder: (folderId: number, folderName: string) => void;
  onCreateFolder: () => void;
}

const PhotoBankFoldersList = ({
  folders,
  selectedFolder,
  loading,
  onSelectFolder,
  onDeleteFolder,
  onCreateFolder
}: PhotoBankFoldersListProps) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Folder" size={20} />
          Папки ({folders.length})
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
            <p className="text-sm">Нет папок</p>
            <Button
              variant="link"
              size="sm"
              onClick={onCreateFolder}
              className="mt-2"
            >
              Создать первую папку
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedFolder?.id === folder.id
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:border-muted-foreground/20 hover:bg-muted/50'
                }`}
                onClick={() => onSelectFolder(folder)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="Folder" size={16} className="text-primary shrink-0" />
                      <p className="font-medium text-sm truncate">{folder.folder_name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {folder.photo_count || 0} фото
                      </Badge>
                      <span className="truncate">{formatDate(folder.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(folder.id, folder.folder_name);
                    }}
                  >
                    <Icon name="Trash2" size={14} />
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

export default PhotoBankFoldersList;
