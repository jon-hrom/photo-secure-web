import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getFolderInitials = (name: string) => {
    const words = name.split(' ');
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Card className="lg:col-span-2">
      <CardContent className="p-0">
        {loading && folders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="Loader2" size={32} className="animate-spin mx-auto mb-2" />
            Загрузка...
          </div>
        ) : folders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Название</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden md:table-cell">Дата создания</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground hidden lg:table-cell">Фото</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {folders.map((folder) => (
                  <tr
                    key={folder.id}
                    className={`border-b hover:bg-accent/50 transition-colors cursor-pointer ${
                      selectedFolder?.id === folder.id ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => onSelectFolder(folder)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Icon name="Folder" size={20} className="text-orange-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{folder.folder_name}</p>
                          <p className="text-sm text-muted-foreground md:hidden">
                            {folder.photo_count || 0} фото • {formatDate(folder.created_at)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(folder.created_at)}
                    </td>
                    <td className="p-3 text-center hidden lg:table-cell">
                      <div className="inline-flex items-center gap-1 text-blue-600 font-medium">
                        <Icon name="Image" size={16} />
                        <span>{folder.photo_count || 0}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFolder(folder);
                          }}
                          title="Открыть папку"
                        >
                          <Icon name="FolderOpen" size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFolder(folder.id, folder.folder_name);
                          }}
                          title="Удалить"
                        >
                          <Icon name="Trash2" size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PhotoBankFoldersList;