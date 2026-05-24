import SubfolderSettingsModal from '@/components/photobank/SubfolderSettingsModal';
import RetouchDialog from '@/components/photobank/RetouchDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

function CreateSubfolderDialog({ open, onOpenChange, subfolderName, onSetSubfolderName, onCreateSubfolder }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subfolderName: string;
  onSetSubfolderName: (name: string) => void;
  onCreateSubfolder: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 dark:from-purple-950/80 dark:via-pink-950/60 dark:to-rose-950/80 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Добавить папку</DialogTitle>
          <DialogDescription>Введите название для новой подпапки</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Например: Подготовка"
          value={subfolderName}
          onChange={(e) => onSetSubfolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreateSubfolder()}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onCreateSubfolder}>
            <Icon name="FolderPlus" size={16} className="mr-2" />
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SubfolderSettings {
  id: number;
  folder_name: string;
  has_password?: boolean;
  is_hidden?: boolean;
}

interface PhotoBankAuxDialogsProps {
  createSubfolderParentId: number | null;
  setCreateSubfolderParentId: (id: number | null) => void;
  subfolderName: string;
  setSubfolderName: (name: string) => void;
  userId: string;
  photobankFoldersApi: string;
  fetchFolders: () => void;
  subfolderSettings: SubfolderSettings | null;
  setSubfolderSettings: (s: SubfolderSettings | null) => void;
  retouchFolder: { id: number; name: string; photoId?: number } | null;
  setRetouchFolder: (f: { id: number; name: string; photoId?: number } | null) => void;
}

const PhotoBankAuxDialogs = ({
  createSubfolderParentId,
  setCreateSubfolderParentId,
  subfolderName,
  setSubfolderName,
  userId,
  photobankFoldersApi,
  fetchFolders,
  subfolderSettings,
  setSubfolderSettings,
  retouchFolder,
  setRetouchFolder,
}: PhotoBankAuxDialogsProps) => {
  return (
    <>
      <CreateSubfolderDialog
        open={createSubfolderParentId !== null}
        onOpenChange={(open) => { if (!open) { setCreateSubfolderParentId(null); setSubfolderName(''); } }}
        subfolderName={subfolderName}
        onSetSubfolderName={setSubfolderName}
        onCreateSubfolder={async () => {
          if (!subfolderName.trim() || !createSubfolderParentId) return;
          try {
            const res = await fetch(photobankFoldersApi, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
              body: JSON.stringify({ action: 'create', folder_name: subfolderName, parent_folder_id: createSubfolderParentId })
            });
            if (res.ok) {
              setCreateSubfolderParentId(null);
              setSubfolderName('');
              fetchFolders();
            }
          } catch { /* ignore */ }
        }}
      />

      <SubfolderSettingsModal
        open={subfolderSettings !== null}
        onOpenChange={(open) => { if (!open) setSubfolderSettings(null); }}
        subfolder={subfolderSettings}
        apiUrl={photobankFoldersApi}
        userId={userId}
        onSaved={fetchFolders}
      />

      {retouchFolder && (
        <RetouchDialog
          open={retouchFolder !== null}
          onOpenChange={(open) => { if (!open) setRetouchFolder(null); }}
          folderId={retouchFolder.id}
          folderName={retouchFolder.name}
          userId={userId}
          preselectedPhotoId={retouchFolder.photoId}
          onRetouchComplete={fetchFolders}
        />
      )}
    </>
  );
};

export default PhotoBankAuxDialogs;