import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useState, useMemo } from 'react';
import FolderRow from './FolderRow';
import type { PhotoFolder, Photo } from './types';
import { formatBytes } from './types';

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
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {sortedPhotos.map((photo) => {
                    const isSelected = selectedPhotos.has(photo.id);
                    return (
                      <div key={photo.id} className="flex flex-col">
                        <div
                          className={`relative bg-gray-50 rounded-lg overflow-hidden cursor-pointer group transition-all aspect-[4/5] border ${isSelected ? 'ring-2 ring-red-500 border-red-400' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={() => onViewPhoto(photo)}
                        >
                          <div className="w-full h-full flex items-center justify-center p-1">
                            {photo.is_video ? (
                              <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded"><Icon name="Play" size={32} className="text-white/70" /></div>
                            ) : (
                              <img src={photo.thumbnail_s3_url || photo.s3_url || ''} alt={photo.file_name} className="max-w-full max-h-full object-contain" loading="lazy" />
                            )}
                          </div>
                          {photo.is_raw && <span className="absolute top-1 right-1 text-[9px] bg-orange-500 text-white px-1 rounded">RAW</span>}
                          {photo.tech_reject_reason && <span className="absolute top-1 left-7"><Icon name="AlertTriangle" size={14} className="text-red-500 drop-shadow" /></span>}
                          <div className={`absolute top-1 left-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={(e) => onTogglePhotoSelection(photo.id, e)}>
                            <Checkbox checked={isSelected} className="h-5 w-5 bg-white/80 border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                          </div>
                          {(photo.photo_download_count ?? 0) > 0 && (
                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600/90 flex items-center gap-1">
                              <Icon name="Download" size={10} className="text-white" />
                              <span className="text-white text-[10px] font-medium">{photo.photo_download_count}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 px-0.5 truncate" title={photo.file_name}>
                          {photo.file_name}
                        </p>
                      </div>
                    );
                  })}
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
