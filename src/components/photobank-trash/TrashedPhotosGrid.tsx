import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { TrashedPhoto } from './types';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface TrashedPhotosGridProps {
  photos: TrashedPhoto[];
  filteredAndSortedPhotos: TrashedPhoto[];
  loading: boolean;
  restoring: number | null;
  deleting: number | null;
  selectionMode: boolean;
  selectedPhotoIds: Set<number>;
  searchQuery: string;
  sortBy: 'date' | 'name' | 'size';
  filterCritical: boolean;
  onRestorePhoto: (photoId: number, fileName: string) => void;
  onDeletePhotoForever: (photoId: number, fileName: string) => void;
  onBulkRestore: () => void;
  onBulkDelete: () => void;
  onToggleSelection: (photoId: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  setSelectionMode: (mode: boolean) => void;
  setSelectedPhotoIds: (ids: Set<number>) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: 'date' | 'name' | 'size') => void;
  setFilterCritical: (filter: boolean) => void;
  getDaysLeftBadge: (dateStr: string) => { days: number; variant: string; text: string };
  formatDate: (dateStr: string) => string;
}

const TrashedPhotosGrid = ({
  photos,
  filteredAndSortedPhotos,
  loading,
  restoring,
  deleting,
  selectionMode,
  selectedPhotoIds,
  searchQuery,
  sortBy,
  filterCritical,
  onRestorePhoto,
  onDeletePhotoForever,
  onBulkRestore,
  onBulkDelete,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  setSelectionMode,
  setSelectedPhotoIds,
  setSearchQuery,
  setSortBy,
  setFilterCritical,
  getDaysLeftBadge,
  formatDate
}: TrashedPhotosGridProps) => {
  const [viewPhoto, setViewPhoto] = useState<TrashedPhoto | null>(null);
  
  const handlePhotoClick = (photo: TrashedPhoto) => {
    if (!selectionMode) {
      setViewPhoto(photo);
    } else {
      onToggleSelection(photo.id);
    }
  };
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!viewPhoto) return;
    const currentIndex = filteredAndSortedPhotos.findIndex(p => p.id === viewPhoto.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < filteredAndSortedPhotos.length) {
      setViewPhoto(filteredAndSortedPhotos[newIndex]);
    }
  };

  const currentPhotoIndex = viewPhoto ? filteredAndSortedPhotos.findIndex(p => p.id === viewPhoto.id) : -1;
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < filteredAndSortedPhotos.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewPhoto) return;
      
      if (e.key === 'Escape') {
        setViewPhoto(null);
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        handleNavigate('prev');
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewPhoto, hasPrev, hasNext]);

  if (photos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <Icon name="Image" size={20} />
            Удаленные фото ({filteredAndSortedPhotos.length}/{photos.length})
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {!selectionMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode(true)}
              >
                <Icon name="CheckSquare" className="mr-2" size={16} />
                Выбрать
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSelectAll}
                >
                  Выбрать все
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDeselectAll}
                >
                  Снять выбор
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onBulkRestore}
                  disabled={selectedPhotoIds.size === 0 || loading}
                >
                  <Icon name="Undo2" className="mr-2" size={16} />
                  Восстановить ({selectedPhotoIds.size})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onBulkDelete}
                  disabled={selectedPhotoIds.size === 0 || loading}
                >
                  <Icon name="Trash2" className="mr-2" size={16} />
                  Удалить ({selectedPhotoIds.size})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedPhotoIds(new Set());
                  }}
                >
                  Отмена
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по имени..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="date">По дате</option>
            <option value="name">По имени</option>
            <option value="size">По размеру</option>
          </select>
          <Button
            variant={filterCritical ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCritical(!filterCritical)}
          >
            <Icon name="AlertTriangle" className="mr-2" size={16} />
            Только критичные
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredAndSortedPhotos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="Search" size={48} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Ничего не найдено</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {filteredAndSortedPhotos.map((photo) => {
              const isVertical = (photo.height || 0) > (photo.width || 0);
              return (
            <div
              key={photo.id}
              className={`relative group rounded-lg overflow-hidden border-2 transition-colors bg-muted/30 ${
                selectedPhotoIds.has(photo.id) 
                  ? 'border-primary ring-2 ring-primary' 
                  : 'border-muted hover:border-muted-foreground/20'
              } ${isVertical ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}
              onClick={() => handlePhotoClick(photo)}
            >
              {selectionMode && (
                <div className="absolute top-2 left-2 z-10">
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    selectedPhotoIds.has(photo.id)
                      ? 'bg-primary border-primary'
                      : 'bg-white/80 border-white'
                  }`}>
                    {selectedPhotoIds.has(photo.id) && (
                      <Icon name="Check" size={16} className="text-white" />
                    )}
                  </div>
                </div>
              )}
              <div className="w-full h-full">
                {photo.s3_url ? (
                  <img
                    src={photo.s3_url}
                    alt={photo.file_name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="ImageOff" size={32} className="text-muted-foreground" />
                  </div>
                )}
              </div>
              {!selectionMode && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 p-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onRestorePhoto(photo.id, photo.file_name)}
                  disabled={restoring === photo.id || deleting === photo.id}
                  className="w-full"
                >
                  {restoring === photo.id ? (
                    <Icon name="Loader2" size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Icon name="Undo2" size={14} className="mr-1" />
                      Восстановить
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDeletePhotoForever(photo.id, photo.file_name)}
                  disabled={restoring === photo.id || deleting === photo.id}
                  className="w-full"
                >
                  {deleting === photo.id ? (
                    <Icon name="Loader2" size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Icon name="Trash2" size={14} className="mr-1" />
                      Удалить навсегда
                    </>
                  )}
                </Button>
                </div>
              )}
              {!selectionMode && (
                <div className="absolute top-2 right-2">
                <Badge 
                  variant={getDaysLeftBadge(photo.trashed_at).variant as any}
                  className="text-[10px] px-1.5 py-0.5"
                >
                  <Icon name="Clock" size={10} className="mr-0.5" />
                  {getDaysLeftBadge(photo.trashed_at).text}
                </Badge>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-xs text-white truncate">{photo.file_name}</p>
                <p className="text-[10px] text-white/70">{formatDate(photo.trashed_at)}</p>
              </div>
            </div>
          );
          })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent hideCloseButton className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-0">
          {viewPhoto && (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-50">
                <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  {currentPhotoIndex + 1} / {filteredAndSortedPhotos.length}
                </div>
                <button
                  onClick={() => setViewPhoto(null)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                >
                  <Icon name="X" size={24} className="text-white" />
                </button>
              </div>

              {hasPrev && (
                <button
                  onClick={() => handleNavigate('prev')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                >
                  <Icon name="ChevronLeft" size={28} className="text-white" />
                </button>
              )}

              {hasNext && (
                <button
                  onClick={() => handleNavigate('next')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                >
                  <Icon name="ChevronRight" size={28} className="text-white" />
                </button>
              )}
              
              <div className="relative max-w-full max-h-[90vh] flex items-center justify-center p-4">
                <img
                  src={viewPhoto.s3_url || ''}
                  alt={viewPhoto.file_name}
                  className="max-w-full max-h-[85vh] object-contain rounded-lg"
                />
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-white font-medium text-lg">{viewPhoto.file_name}</p>
                  <Badge 
                    variant={getDaysLeftBadge(viewPhoto.trashed_at).variant as any}
                    className="text-xs"
                  >
                    <Icon name="Clock" size={12} className="mr-1" />
                    {getDaysLeftBadge(viewPhoto.trashed_at).text}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-white/70 text-sm mb-4">
                  <span>{formatBytes(viewPhoto.file_size || 0)}</span>
                  {viewPhoto.width && viewPhoto.height && (
                    <span>{viewPhoto.width} × {viewPhoto.height}</span>
                  )}
                  <span>Удалено: {formatDate(viewPhoto.trashed_at)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestorePhoto(viewPhoto.id, viewPhoto.file_name);
                      setViewPhoto(null);
                    }}
                    disabled={restoring === viewPhoto.id}
                    className="bg-green-600/80 hover:bg-green-600 text-white border-0"
                  >
                    {restoring === viewPhoto.id ? (
                      <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                    ) : (
                      <Icon name="Undo2" size={16} className="mr-2" />
                    )}
                    Восстановить
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePhotoForever(viewPhoto.id, viewPhoto.file_name);
                      setViewPhoto(null);
                    }}
                    disabled={deleting === viewPhoto.id}
                    className="bg-red-600/80 hover:bg-red-600 border-0"
                  >
                    {deleting === viewPhoto.id ? (
                      <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                    ) : (
                      <Icon name="Trash2" size={16} className="mr-2" />
                    )}
                    Удалить навсегда
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TrashedPhotosGrid;