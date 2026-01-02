import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface Folder {
  id: number;
  name: string;
}

interface FolderSelectionProps {
  folderMode: 'new' | 'existing';
  folderName: string;
  selectedFolderId: number | null;
  folders: Folder[];
  uploading: boolean;
  onFolderModeChange: (mode: 'new' | 'existing') => void;
  onFolderNameChange: (name: string) => void;
  onFolderSelect: (id: number | null) => void;
}

const FolderSelection = ({
  folderMode,
  folderName,
  selectedFolderId,
  folders,
  uploading,
  onFolderModeChange,
  onFolderNameChange,
  onFolderSelect
}: FolderSelectionProps) => {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={folderMode === 'new' ? 'default' : 'outline'}
          onClick={() => onFolderModeChange('new')}
          disabled={uploading}
          className="flex-1"
        >
          <Icon name="FolderPlus" className="mr-2" size={16} />
          Новая папка
        </Button>
        <Button
          variant={folderMode === 'existing' ? 'default' : 'outline'}
          onClick={() => onFolderModeChange('existing')}
          disabled={uploading}
          className="flex-1"
        >
          <Icon name="Folder" className="mr-2" size={16} />
          Существующая
        </Button>
      </div>

      {folderMode === 'new' ? (
        <div className="space-y-2">
          <Label htmlFor="folder-name">Название папки</Label>
          <Input
            id="folder-name"
            value={folderName}
            onChange={(e) => onFolderNameChange(e.target.value)}
            placeholder="Название папки"
            disabled={uploading}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Выберите папку</Label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {folders.map(folder => (
              <Button
                key={folder.id}
                variant={selectedFolderId === folder.id ? 'default' : 'outline'}
                onClick={() => onFolderSelect(folder.id)}
                disabled={uploading}
                className="justify-start"
              >
                <Icon name="Folder" className="mr-2" size={16} />
                <span className="truncate">{folder.name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderSelection;
