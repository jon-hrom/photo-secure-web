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
  onShareFolder?: (folderId: number, folderName: string) => void;
  onOpenChat?: (clientId: number, clientName: string) => void;
  isAdminViewing?: boolean;
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
  onShareFolder,
  onOpenChat,
  isAdminViewing = false
}: PhotoBankFoldersListProps) => {
  // DEBUG: показать данные папок с unread_messages_count
  React.useEffect(() => {
    console.log('[DEBUG] PhotoBankFoldersList folders:', folders.map(f => ({
      id: f.id,
      name: f.folder_name,
      unread_messages_count: f.unread_messages_count,
      client_id: f.client_id
    })));
  }, [folders]);

  // Используем sessionStorage для хранения состояния сворачивания
  const STORAGE_KEY = 'photobank_collapsed_folders';
  
  const [collapsedFolders, setCollapsedFolders] = React.useState<Set<number>>(() => {
    // Пытаемся загрузить из sessionStorage
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return new Set(parsed);
      } catch (e) {
        // Если ошибка парсинга, сворачиваем все
      }
    }
    
    // По умолчанию все папки с подпапками свёрнуты
    const parentIds = folders.filter(f => f.parent_folder_id).map(f => f.parent_folder_id);
    return new Set(parentIds);
  });

  const toggleCollapse = (folderId: number) => {
    setCollapsedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      
      // Сохраняем в sessionStorage
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newSet)));
      
      return newSet;
    });
  };
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

  // Группируем папки: основные папки и их подпапки
  const mainFolders = folders.filter(f => !f.parent_folder_id);
  const getSubfolders = (parentId: number) => folders.filter(f => f.parent_folder_id === parentId);

  const canStartTechSort = (folder: PhotoFolder) => {
    // Можно запустить сортировку только для папок originals с фото
    return folder.folder_type === 'originals' && (folder.photo_count || 0) > 0;
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
                {mainFolders.map((folder) => {
                  const subfolders = getSubfolders(folder.id);
                  return (
                    <React.Fragment key={folder.id}>
                      <tr
                        className={`border-b hover:bg-accent/50 transition-colors cursor-pointer ${
                          selectedFolder?.id === folder.id ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => onSelectFolder(folder)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {subfolders.length > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCollapse(folder.id);
                                }}
                                className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded transition-colors flex-shrink-0"
                                title={collapsedFolders.has(folder.id) ? 'Развернуть' : 'Свернуть'}
                              >
                                <Icon 
                                  name={collapsedFolders.has(folder.id) ? 'ChevronRight' : 'ChevronDown'} 
                                  size={16} 
                                  className="text-muted-foreground"
                                />
                              </button>
                            ) : (
                              <div className="w-6 flex-shrink-0" />
                            )}
                            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                              <Icon name="Folder" size={20} className="text-orange-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{folder.folder_name}</p>
                                {folder.folder_type === 'originals' && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Оригиналы</span>
                                )}
                              </div>
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
                            {(folder.unread_messages_count ?? 0) > 0 && (
                              <div className="inline-flex items-center gap-1 text-yellow-600 font-medium" title="Непрочитанные сообщения от клиентов">
                                <Icon name="Mail" size={16} />
                                <span>{folder.unread_messages_count}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {canStartTechSort(folder) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 text-xs sm:text-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartTechSort(folder.id, folder.folder_name);
                                }}
                                title="Отобрать фото на технический брак"
                              >
                                <Icon name="SlidersHorizontal" size={14} className="mr-1" />
                                <span className="hidden sm:inline">Отобрать</span>
                                <span className="sm:hidden">
                                  <Icon name="SlidersHorizontal" size={14} />
                                </span>
                              </Button>
                            )}
                            {onOpenChat && folder.client_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 relative"
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
                            {onShareFolder && folder.photo_count > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onShareFolder(folder.id, folder.folder_name);
                                }}
                                title="Поделиться галереей"
                              >
                                <Icon name="Share2" size={16} />
                              </Button>
                            )}
                            {onDownloadFolder && folder.photo_count > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
                      {!collapsedFolders.has(folder.id) && subfolders.map((subfolder) => (
                        <tr
                          key={subfolder.id}
                          className={`border-b hover:bg-accent/50 transition-colors cursor-pointer bg-muted/30 ${
                            selectedFolder?.id === subfolder.id ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => onSelectFolder(subfolder)}
                        >
                          <td className="p-3 pl-12">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                <Icon name="AlertTriangle" size={20} className="text-red-600" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate text-sm">{subfolder.folder_name}</p>
                                  {subfolder.folder_type === 'tech_rejects' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Брак</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground md:hidden">
                                  {subfolder.photo_count || 0} фото
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                            {formatDate(subfolder.created_at)}
                          </td>
                          <td className="p-3 text-center hidden lg:table-cell">
                            <div className="inline-flex items-center gap-1 text-red-600 font-medium">
                              <Icon name="Image" size={16} />
                              <span>{subfolder.photo_count || 0}</span>
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
                                  onSelectFolder(subfolder);
                                }}
                                title="Открыть папку"
                              >
                                <Icon name="FolderOpen" size={16} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PhotoBankFoldersList;