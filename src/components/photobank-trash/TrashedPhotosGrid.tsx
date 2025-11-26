import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { TrashedPhoto } from './types';
import { useState } from 'react';
import TrashedPhotosHeader from './TrashedPhotosHeader';
import TrashedPhotoCard from './TrashedPhotoCard';
import TrashedPhotoViewer from './TrashedPhotoViewer';

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

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedPhotoIds(new Set());
  };

  if (photos.length === 0) return null;

  return (
    <Card>
      <TrashedPhotosHeader
        photosCount={photos.length}
        filteredCount={filteredAndSortedPhotos.length}
        selectionMode={selectionMode}
        selectedCount={selectedPhotoIds.size}
        loading={loading}
        searchQuery={searchQuery}
        sortBy={sortBy}
        filterCritical={filterCritical}
        onSetSelectionMode={setSelectionMode}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        onBulkRestore={onBulkRestore}
        onBulkDelete={onBulkDelete}
        onSetSearchQuery={setSearchQuery}
        onSetSortBy={setSortBy}
        onSetFilterCritical={setFilterCritical}
        onCancelSelection={handleCancelSelection}
      />
      <CardContent>
        {filteredAndSortedPhotos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="Search" size={48} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Ничего не найдено</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {filteredAndSortedPhotos.map((photo) => (
              <TrashedPhotoCard
                key={photo.id}
                photo={photo}
                selectionMode={selectionMode}
                isSelected={selectedPhotoIds.has(photo.id)}
                restoring={restoring}
                deleting={deleting}
                onPhotoClick={handlePhotoClick}
                onRestorePhoto={onRestorePhoto}
                onDeletePhotoForever={onDeletePhotoForever}
                getDaysLeftBadge={getDaysLeftBadge}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </CardContent>

      <TrashedPhotoViewer
        viewPhoto={viewPhoto}
        photos={filteredAndSortedPhotos}
        restoring={restoring}
        deleting={deleting}
        onClose={() => setViewPhoto(null)}
        onNavigate={handleNavigate}
        onRestorePhoto={onRestorePhoto}
        onDeletePhotoForever={onDeletePhotoForever}
        getDaysLeftBadge={getDaysLeftBadge}
        formatDate={formatDate}
        formatBytes={formatBytes}
      />
    </Card>
  );
};

export default TrashedPhotosGrid;
