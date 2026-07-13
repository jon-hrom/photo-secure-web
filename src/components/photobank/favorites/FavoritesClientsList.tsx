import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { resolveClientPhotos } from './useFavoritesData';
import type { ClientData, Photo, DownloadProgress } from './useFavoritesData';

interface FavoritesClientsListProps {
  clients: ClientData[];
  allPhotos: Photo[];
  downloadProgress?: DownloadProgress | null;
  onClientSelect: (client: ClientData) => void;
  onPhotoSelect: (photo: Photo, client: ClientData) => void;
  onDownloadClient: (client: ClientData) => void;
}

export default function FavoritesClientsList({
  clients,
  allPhotos,
  downloadProgress,
  onClientSelect,
  onPhotoSelect,
  onDownloadClient
}: FavoritesClientsListProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (clientId: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {clients.map(client => {
        const displayPhotos = resolveClientPhotos(client, allPhotos);

        if (displayPhotos.length === 0) return null;

        const isExpanded = expanded.has(client.client_id);
        const isDownloading = downloadProgress?.clientId === client.client_id;
        const progressPercent = isDownloading && downloadProgress.total > 0
          ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
          : 0;

        return (
          <div
            key={client.client_id}
            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => toggle(client.client_id)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left"
              >
                <Icon
                  name="ChevronRight"
                  size={18}
                  className={`flex-shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {client.full_name}
                  </h3>
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {client.phone} · {displayPhotos.length} фото
                    </p>
                    {client.cover_photo_id && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-medium">
                        <Icon name="Image" size={10} /> обложка ✓
                      </span>
                    )}
                    {client.vignette_photo_id && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-medium">
                        <Icon name="Sparkles" size={10} /> виньетка ✓
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownloadClient(client)}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <>
                      <Icon name="Loader2" size={16} className="animate-spin" />
                      <span className="ml-2">
                        Архивирую {downloadProgress.current}/{downloadProgress.total}
                      </span>
                    </>
                  ) : (
                    <>
                      <Icon name="Download" size={16} />
                      <span className="ml-2 hidden sm:inline">Скачать все ({displayPhotos.length})</span>
                      <span className="ml-2 sm:hidden">{displayPhotos.length}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {isDownloading && (
              <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {isExpanded && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {displayPhotos.map(photo => {
                  const isCover = client.cover_photo_id === photo.id;
                  const isVignette = client.vignette_photo_id === photo.id;
                  return (
                  <div
                    key={photo.id}
                    className="relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer group"
                    onClick={() => onPhotoSelect(photo, client)}
                  >
                    <div className="absolute top-1 left-1 text-[10px] font-medium text-white bg-black/50 px-1.5 py-0.5 rounded z-10 max-w-[calc(100%-0.5rem)] truncate">
                      {photo.file_name}
                    </div>
                    {(isCover || isVignette) && (
                      <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center gap-1 pt-1 px-1 pointer-events-none">
                        {isCover && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-[10px] font-bold uppercase tracking-wide shadow-lg ring-2 ring-white/70">
                            <Icon name="Image" size={11} /> Обложка
                          </span>
                        )}
                        {isVignette && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-[10px] font-bold uppercase tracking-wide shadow-lg ring-2 ring-white/70">
                            <Icon name="Sparkles" size={11} /> Виньетка
                          </span>
                        )}
                      </div>
                    )}
                    <img
                      src={photo.thumbnail_url || photo.preview_url || photo.photo_url}
                      alt={photo.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const icon = target.nextElementSibling;
                        if (icon) icon.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-gray-600">
                      <Icon name="Image" size={32} className="text-gray-500" />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Icon 
                        name="Maximize2" 
                        size={24} 
                        className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}