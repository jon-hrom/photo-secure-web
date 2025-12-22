import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';

interface PhotoBankDialogsProps {
  showCreateFolder: boolean;
  showClearConfirm: boolean;
  folderName: string;
  foldersCount: number;
  onSetShowCreateFolder: (show: boolean) => void;
  onSetShowClearConfirm: (show: boolean) => void;
  onSetFolderName: (name: string) => void;
  onCreateFolder: () => void;
  onClearAll: () => void;
}

const PhotoBankDialogs = ({
  showCreateFolder,
  showClearConfirm,
  folderName,
  foldersCount,
  onSetShowCreateFolder,
  onSetShowClearConfirm,
  onSetFolderName,
  onCreateFolder,
  onClearAll
}: PhotoBankDialogsProps) => {
  return (
    <>
      <Dialog open={showCreateFolder} onOpenChange={onSetShowCreateFolder}>
        <DialogContent className="bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 dark:from-purple-950/80 dark:via-pink-950/60 dark:to-rose-950/80 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Создать папку</DialogTitle>
            <DialogDescription>
              Введите название для новой папки с фотографиями
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Например: Отпуск 2025"
            value={folderName}
            onChange={(e) => onSetFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onSetShowCreateFolder(false)}>
              Отмена
            </Button>
            <Button onClick={onCreateFolder}>
              <Icon name="FolderPlus" size={16} className="mr-2" />
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearConfirm} onOpenChange={onSetShowClearConfirm}>
        <DialogContent className="bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 dark:from-purple-950/80 dark:via-pink-950/60 dark:to-rose-950/80 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Icon name="AlertTriangle" size={24} />
              Очистить весь банк?
            </DialogTitle>
            <DialogDescription>
              Это действие удалит ВСЕ папки и фотографии из вашего фото банка безвозвратно. Это нельзя отменить!
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <Icon name="AlertCircle" size={16} />
            <AlertDescription>
              Будут удалены: {foldersCount} {foldersCount === 1 ? 'папка' : 'папок'} и все фотографии внутри
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => onSetShowClearConfirm(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={onClearAll}>
              <Icon name="Trash2" size={16} className="mr-2" />
              Да, очистить всё
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PhotoBankDialogs;