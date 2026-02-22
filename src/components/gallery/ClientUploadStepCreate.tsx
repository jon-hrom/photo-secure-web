import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateProps {
  newFolderName: string;
  clientName: string;
  inputCls: string;
  subText: string;
  onChangeFolderName: (v: string) => void;
  onChangeClientName: (v: string) => void;
  onSubmit: () => void;
}

interface RenameProps {
  renameValue: string;
  renamingFolder: boolean;
  inputCls: string;
  subText: string;
  onChangeRenameValue: (v: string) => void;
  onSubmit: () => void;
}

export function ClientUploadStepCreate({
  newFolderName,
  clientName,
  inputCls,
  subText,
  onChangeFolderName,
  onChangeClientName,
  onSubmit,
}: CreateProps) {
  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">Название папки *</label>
        <Input
          value={newFolderName}
          onChange={(e) => onChangeFolderName(e.target.value)}
          placeholder="Например: Фото от Ивановых"
          className={`h-11 ${inputCls}`}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">Ваше имя</label>
        <Input
          value={clientName}
          onChange={(e) => onChangeClientName(e.target.value)}
          placeholder="Как вас зовут?"
          className={`h-11 ${inputCls}`}
        />
      </div>
      <Button
        onClick={onSubmit}
        disabled={!newFolderName.trim()}
        className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
      >
        <Icon name="FolderPlus" size={18} className="mr-2" />
        Создать и перейти к загрузке
      </Button>
    </>
  );
}

export function ClientUploadStepRename({
  renameValue,
  renamingFolder,
  inputCls,
  subText,
  onChangeRenameValue,
  onSubmit,
}: RenameProps) {
  return (
    <>
      <p className={`text-sm ${subText}`}>Введите новое название папки</p>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">Новое название *</label>
        <Input
          value={renameValue}
          onChange={(e) => onChangeRenameValue(e.target.value)}
          placeholder="Название папки"
          className={`h-11 ${inputCls}`}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
      </div>
      <Button
        onClick={onSubmit}
        disabled={!renameValue.trim() || renamingFolder}
        className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
      >
        {renamingFolder ? (
          <><Icon name="Loader2" size={18} className="mr-2 animate-spin" />Сохранение...</>
        ) : (
          <><Icon name="Pencil" size={18} className="mr-2" />Сохранить название</>
        )}
      </Button>
    </>
  );
}
