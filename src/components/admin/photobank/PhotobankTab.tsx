import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useState, useMemo } from 'react';
import FolderRow from './FolderRow';
import type { PhotoFolder, Photo } from './types';
import { usePhotoFrames } from '@/hooks/usePhotoFrames';
import AdminPhotoCard from './AdminPhotoCard';

type SortField = 'name' | 'shot_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface PhotobankTabProps {
  folders: PhotoFolder[];
  photos: Photo[];
  selectedFolder: PhotoFolder | null;
  loadingFolders: boolean;
  loadingPhotos: boolean;
  selectedPhotos: Set<number>;
  deleting: boolean;
  onSelectFolder: (folder: PhotoFolder) => void;
  onBack: () => void;
  onDeleteFolder: (folder: PhotoFolder, e: React.MouseEvent) => void;
  onDeleteSelectedPhotos: () => void;
  onTogglePhotoSelection: (photoId: number, e: React.MouseEvent) => void;
  onToggleSelectAll: () => void;
  onViewPhoto: (photo: Photo) => void;
}

const naturalCompare = (a: string, b: string): number => {
  const re = /(\d+)|(\D+)/g;
  const aParts = a.match(re) || [];
  const bParts = b.match(re) || [];
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    if (i >= aParts.length) return -1;
    if (i >= bParts.length) return 1;
    const aNum = parseInt(aParts[i]);
    const bNum = parseInt(bParts[i]);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const cmp = aParts[i].localeCompare(bParts[i]);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
};

const PhotobankTab = ({
  folders,
  photos,
  selectedFolder,
  loadingFolders,
  loadingPhotos,
  selectedPhotos,
  deleting,
  onSelectFolder,
  onBack,
  onDeleteFolder,
  onDeleteSelectedPhotos,
  onTogglePhotoSelection,
  onToggleSelectAll,
  onViewPhoto,
}: PhotobankTabProps) => {
  const mainFolders = folders.filter(f => !f.parent_folder_id);
  const getSubfolders = (parentId: number) => folders.filter(f => f.parent_folder_id === parentId);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { frameMode, setFrameMode, getFrameStyle } = usePhotoFrames();

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = naturalCompare(a.file_name.toLowerCase(), b.file_name.toLowerCase());
      } else if (sortField === 'shot_date') {
        const aDate = a.shot_date || a.created_at || '';
        const bDate = b.shot_date || b.created_at || '';
        cmp = aDate.localeCompare(bDate);
      } else {
        cmp = (a.created_at || '').localeCompare(b.created_at || '');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [photos, sortField, sortDirection]);

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <>
      {selectedFolder && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-4 py-2 border-b bg-muted/30 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack}>
              <Icon name="ArrowLeft" size={16} />
            </Button>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{selectedFolder.folder_name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{photos.length} фото • {selectedFolder.s3_prefix || '—'}</p>
            </div>
          </div>
          {photos.length > 0 && (
            <div className="flex items-center gap-2 pl-9 sm:pl-0 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onToggleSelectAll}>
                <Checkbox checked={selectedPhotos.size === photos.length && photos.length > 0} className="h-3.5 w-3.5" />
                Все
              </Button>
              {selectedPhotos.size > 0 && (
                <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={onDeleteSelectedPhotos} disabled={deleting}>
                  {deleting ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Trash2" size={14} />}
                  Удалить ({selectedPhotos.size})
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2.5 sm:p-4">
        {!selectedFolder ? (
          <>
            {loadingFolders ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
              </div>
            ) : folders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="FolderOpen" size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">У пользователя нет папок</p>
              </div>
            ) : (
              <div className="space-y-1">
                {mainFolders.map((folder) => {
                  const subfolders = getSubfolders(folder.id);
                  return (
                    <div key={folder.id}>
                      <FolderRow folder={folder} onClick={() => onSelectFolder(folder)} onDelete={(e) => onDeleteFolder(folder, e)} formatDate={formatDate} deleting={deleting} />
                      {subfolders.length > 0 && (
                        <div className="ml-6 border-l-2 border-muted pl-2 space-y-1 mt-1">
                          {subfolders.map(sub => (
                            <FolderRow key={sub.id} folder={sub} onClick={() => onSelectFolder(sub)} onDelete={(e) => onDeleteFolder(sub, e)} formatDate={formatDate} deleting={deleting} isSubfolder />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {loadingPhotos ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
              </div>
            ) : photos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="Image" size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">В папке нет фото</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">Сортировка:</span>
                  {([
                    { field: 'name' as SortField, label: 'По имени' },
                    { field: 'shot_date' as SortField, label: 'По дате съёмки' },
                    { field: 'created_at' as SortField, label: 'По дате загрузки' },
                  ]).map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => handleSortChange(field)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        sortField === field 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {label}
                      {sortField === field && (
                        <Icon name={sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown'} size={12} />
                      )}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Рамки:</span>
                    {([
                      { mode: 'none' as const, label: 'Нет', icon: 'Square' },
                      { mode: 'theme' as const, label: 'Тема', icon: 'Frame' },
                      { mode: 'adaptive' as const, label: 'Адаптивные', icon: 'Palette' },
                    ]).map(({ mode, label, icon }) => (
                      <button
                        key={mode}
                        onClick={() => setFrameMode(mode)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          frameMode === mode
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <Icon name={icon} size={12} />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {sortedPhotos.map((photo) => (
                    <AdminPhotoCard
                      key={photo.id}
                      photo={photo}
                      isSelected={selectedPhotos.has(photo.id)}
                      onToggleSelection={onTogglePhotoSelection}
                      onViewPhoto={onViewPhoto}
                      frameMode={frameMode}
                      getFrameStyle={getFrameStyle}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default PhotobankTab;