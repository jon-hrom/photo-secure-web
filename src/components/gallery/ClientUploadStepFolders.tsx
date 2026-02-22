import Icon from '@/components/ui/icon';

interface ClientUploadFolder {
  id: number;
  folder_name: string;
  client_name: string | null;
  photo_count: number;
  created_at: string | null;
  is_own?: boolean;
}

interface Props {
  existingFolders: ClientUploadFolder[];
  subText: string;
  cardBg: string;
  hoverCard: string;
  onSelectFolder: (folder: ClientUploadFolder) => void;
  onViewOtherFolder: (folder: ClientUploadFolder) => void;
  onCreateFolder: () => void;
}

export default function ClientUploadStepFolders({
  existingFolders,
  subText,
  cardBg,
  hoverCard,
  onSelectFolder,
  onViewOtherFolder,
  onCreateFolder,
}: Props) {
  const ownFolders = existingFolders.filter(f => f.is_own !== false);
  const otherFolders = existingFolders.filter(f => f.is_own === false);
  const hasGroups = otherFolders.length > 0;

  return (
    <>
      <p className={`text-sm ${subText}`}>
        Создайте папку и загрузите свои фото. Фотограф увидит вашу папку отдельно от своих фото.
      </p>

      <button
        onClick={onCreateFolder}
        className="w-full h-12 border border-dashed border-white/20 rounded-xl flex items-center justify-center gap-2 text-sm text-gray-300 hover:border-blue-400/60 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
      >
        <Icon name="FolderPlus" size={18} />
        Создать новую папку
      </button>

      {existingFolders.length > 0 && (
        <div className="space-y-2">
          {hasGroups && ownFolders.length > 0 && (
            <p className={`text-xs font-medium uppercase tracking-wide ${subText}`}>
              Мои папки
            </p>
          )}
          {!hasGroups && ownFolders.length > 0 && (
            <p className={`text-xs font-medium ${subText}`}>
              Мои папки
            </p>
          )}
          {ownFolders.map(folder => (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(folder)}
              className={`w-full text-left p-3 rounded-xl border ${cardBg} ${hoverCard} transition-all`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon name="Folder" size={20} className="text-blue-400" />
                  <div>
                    <p className="font-medium text-sm text-white">{folder.folder_name}</p>
                    {folder.client_name && (
                      <p className={`text-xs ${subText}`}>{folder.client_name}</p>
                    )}
                  </div>
                </div>
                <span className={`text-xs ${subText}`}>{folder.photo_count} фото</span>
              </div>
            </button>
          ))}

          {otherFolders.length > 0 && (
            <>
              <p className={`text-xs font-medium uppercase tracking-wide pt-2 ${subText}`}>
                Фото других участников
              </p>
              {otherFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => onViewOtherFolder(folder)}
                  className="w-full text-left p-3 rounded-xl border border-white/8 bg-white/4 hover:border-purple-400/50 hover:bg-purple-500/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon name="FolderOpen" size={20} className="text-purple-400" />
                      <div>
                        <p className="font-medium text-sm text-gray-200">{folder.folder_name}</p>
                        {folder.client_name && (
                          <p className="text-xs text-gray-500">{folder.client_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{folder.photo_count} фото</span>
                      <Icon name="ChevronRight" size={16} className="text-gray-600" />
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
