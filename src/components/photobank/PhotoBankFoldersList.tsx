import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import React from 'react';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
  folder_type?: 'originals' | 'tech_rejects';
  parent_folder_id?: number | null;
  archive_download_count?: number;
  client_id?: number | null;
  unread_messages_count?: number;
  total_messages_count?: number;
  is_hidden?: boolean;
  has_password?: boolean;
  sort_order?: number;
}

interface PhotoBankFoldersListProps {
  folders: PhotoFolder[];
  selectedFolder: PhotoFolder | null;
  loading: boolean;
  onSelectFolder: (folder: PhotoFolder) => void;
  onDeleteFolder: (folderId: number, folderName: string) => void;
  onCreateFolder: () => void;
  onStartTechSort: (folderId: number, folderName: string) => void;
  onDownloadFolder?: (folderId: number, folderName: string) => void;
  onRetouchFolder?: (folderId: number, folderName: string) => void;
  onShareFolder?: (folderId: number, folderName: string) => void;
  onOpenChat?: (clientId: number, clientName: string) => void;
  onOpenFolderChats?: (folderId: number) => void;
  isAdminViewing?: boolean;
  onCreateSubfolder?: (parentFolderId: number) => void;
  onOpenSubfolderSettings?: (subfolder: PhotoFolder) => void;
}

const PhotoBankFoldersList = ({
  folders,
  selectedFolder,
  loading,
  onSelectFolder,
  onDeleteFolder,
  onCreateFolder,
  onStartTechSort,
  onDownloadFolder,
  onRetouchFolder,
  onShareFolder,
  onOpenChat,
  onOpenFolderChats,
  isAdminViewing = false,
  onCreateSubfolder,
  onOpenSubfolderSettings
}: PhotoBankFoldersListProps) => {
  React.useEffect(() => {
    console.log('[DEBUG] PhotoBankFoldersList folders:', folders.map(f => ({
      id: f.id,
      name: f.folder_name,
      unread_messages_count: f.unread_messages_count,
      client_id: f.client_id
    })));
  }, [folders]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const mainFolders = folders.filter(f => !f.parent_folder_id);

  const canStartTechSort = (folder: PhotoFolder) => {
    return folder.folder_type === 'originals' && (folder.photo_count || 0) > 0;
  };

  return (
    <Card className="lg:col-span-2">
      <CardContent className="p-0 max-h-[calc(100vh-320px)] overflow-y-auto">
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
          <div className="overflow-x-auto pb-24 md:pb-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-2 py-1.5 text-sm font-medium text-muted-foreground">Название</th>
                  <th className="text-left px-2 py-1.5 text-sm font-medium text-muted-foreground hidden md:table-cell">Дата создания</th>
                  <th className="text-center px-2 py-1.5 text-sm font-medium text-muted-foreground hidden lg:table-cell">Фото</th>
                  <th className="text-left md:text-right px-2 py-1.5 text-sm font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {mainFolders.map((folder) => (
                  <tr
                    key={folder.id}
                    className={`border-b hover:bg-accent/50 transition-colors cursor-pointer ${
                      selectedFolder?.id === folder.id ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => onSelectFolder(folder)}
                  >
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Icon name="Folder" size={16} className="text-orange-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium break-words text-sm">{folder.folder_name}</p>
                            {folder.folder_type === 'originals' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Оригиналы</span>
                            )}
                            {(folder.unread_messages_count ?? 0) > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenFolderChats?.(folder.id);
                                }}
                                className="inline-flex items-center gap-1 text-yellow-600 font-medium hover:text-yellow-700 transition-colors"
                                title="Непрочитанные сообщения от клиентов"
                              >
                                <Icon name="Mail" size={16} />
                                <span className="text-xs">{folder.unread_messages_count}</span>
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {folder.photo_count || 0} фото • {formatDate(folder.created_at)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(folder.created_at)}
                    </td>
                    <td className="px-2 py-1.5 text-center hidden lg:table-cell">
                      <div className="flex items-center justify-center gap-3">
                        <div className="inline-flex items-center gap-1 text-blue-600 font-medium">
                          <Icon name="Image" size={16} />
                          <span>{folder.photo_count || 0}</span>
                        </div>
                        {(folder.archive_download_count ?? 0) > 0 && (
                          <div className="inline-flex items-center gap-1 text-emerald-600 font-medium" title="Скачиваний архива клиентами">
                            <Icon name="Download" size={16} />
                            <span>{folder.archive_download_count}</span>
                          </div>
                        )}
                        {(() => {
                          const unread = folder.unread_messages_count ?? 0;
                          const total = folder.total_messages_count ?? 0;
                          console.log(`[RENDER] Folder ${folder.id}: unread=${unread}, total=${total}`);
                          return total > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenFolderChats?.(folder.id);
                              }}
                              className={`inline-flex items-center gap-1 font-medium transition-colors ${
                                unread > 0 
                                  ? 'text-yellow-600 hover:text-yellow-700' 
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                              title={unread > 0 ? `Непрочитанных: ${unread} из ${total}` : `Сообщений: ${total}`}
                            >
                              <Icon name="Mail" size={16} />
                              {unread > 0 && <span>{unread}</span>}
                            </button>
                          ) : null;
                        })()}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-0.5 justify-items-start md:justify-items-end">
                        {canStartTechSort(folder) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-50 hover:scale-110 active:scale-95 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartTechSort(folder.id, folder.folder_name);
                            }}
                            title="Отобрать фото на технический брак"
                          >
                            <Icon name="SlidersHorizontal" size={14} />
                          </Button>
                        )}
                        {onOpenChat && folder.client_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 relative hover:scale-110 active:scale-95 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChat(folder.client_id!, folder.folder_name);
                            }}
                            title="Сообщения от клиента"
                          >
                            <Icon name="Mail" size={16} />
                            {(folder.unread_messages_count ?? 0) > 0 && (
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {folder.unread_messages_count}
                              </span>
                            )}
                          </Button>
                        )}
                        {onOpenFolderChats && !folder.client_id && (folder.total_messages_count ?? 0) > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 relative hover:scale-110 active:scale-95 transition-all duration-200 ${
                              (folder.unread_messages_count ?? 0) > 0
                                ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFolderChats(folder.id);
                            }}
                            title={
                              (folder.unread_messages_count ?? 0) > 0
                                ? `Непрочитанных: ${folder.unread_messages_count}`
                                : 'Сообщения от клиентов'
                            }
                          >
                            <Icon name="Mail" size={14} />
                            {(folder.unread_messages_count ?? 0) > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                                {folder.unread_messages_count}
                              </span>
                            )}
                          </Button>
                        )}
                        {onRetouchFolder && folder.photo_count > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:scale-110 active:scale-95 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetouchFolder(folder.id, folder.folder_name);
                            }}
                            title="Ретушь фото"
                          >
                            <Icon name="Sparkles" size={14} />
                          </Button>
                        )}
                        {onShareFolder && folder.photo_count > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 hover:scale-110 active:scale-95 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              onShareFolder(folder.id, folder.folder_name);
                            }}
                            title="Поделиться галереей"
                          >
                            <Icon name="Share2" size={14} />
                          </Button>
                        )}
                        {onDownloadFolder && folder.photo_count > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:scale-110 active:scale-95 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadFolder(folder.id, folder.folder_name);
                            }}
                            title="Скачать архивом"
                          >
                            <Icon name="Download" size={16} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:scale-110 active:scale-95 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFolder(folder);
                          }}
                          title="Открыть папку"
                        >
                          <Icon name="FolderOpen" size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:scale-110 active:scale-95 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFolder(folder.id, folder.folder_name);
                          }}
                          title="Удалить"
                        >
                          <Icon name="Trash2" size={14} />
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