import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import FolderRow from './FolderRow';
import type { PhotoFolder, Photo } from './types';
import { formatBytes } from './types';

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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                {photos.map((photo) => {
                  const isSelected = selectedPhotos.has(photo.id);
                  return (
                    <div key={photo.id} className={`relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer group transition-all ${isSelected ? 'ring-2 ring-red-500' : 'hover:ring-2 hover:ring-primary/50'}`} onClick={() => onViewPhoto(photo)}>
                      {photo.is_video ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-900"><Icon name="Play" size={32} className="text-white/70" /></div>
                      ) : (
                        <img src={photo.thumbnail_s3_url || photo.s3_url || ''} alt={photo.file_name} className="w-full h-full object-cover" loading="lazy" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate">{photo.file_name}</p>
                        <p className="text-[9px] text-white/70">{formatBytes(photo.file_size)}</p>
                      </div>
                      {photo.is_raw && <span className="absolute top-1 right-1 text-[9px] bg-orange-500 text-white px-1 rounded">RAW</span>}
                      {photo.tech_reject_reason && <span className="absolute top-1 left-7"><Icon name="AlertTriangle" size={14} className="text-red-500 drop-shadow" /></span>}
                      <div className={`absolute top-1 left-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={(e) => onTogglePhotoSelection(photo.id, e)}>
                        <Checkbox checked={isSelected} className="h-5 w-5 bg-white/80 border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default PhotobankTab;
