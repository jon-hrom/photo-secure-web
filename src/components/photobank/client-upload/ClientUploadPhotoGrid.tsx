import Icon from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { formatBytes } from "./types";
import type { ClientPhoto } from "./types";

interface ClientUploadPhotoGridProps {
  photos: ClientPhoto[];
  isLoading: boolean;
  deletingPhotoId: number | null;
  onOpenLightbox: (index: number) => void;
  onDownload: (photo: ClientPhoto) => void;
  onDelete: (photoId: number) => void;
}

const ClientUploadPhotoGrid = ({
  photos,
  isLoading,
  deletingPhotoId,
  onOpenLightbox,
  onDownload,
  onDelete,
}: ClientUploadPhotoGridProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon
          name="Loader2"
          size={24}
          className="animate-spin text-muted-foreground"
        />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Icon
          name="ImageOff"
          size={32}
          className="mx-auto mb-2 opacity-50"
        />
        <p className="text-sm">Нет фотографий</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
      {photos.map((photo, photoIdx) => (
        <div
          key={photo.id}
          className="group relative rounded-lg overflow-hidden border border-border bg-muted/30"
        >
          <div
            className="aspect-square cursor-pointer overflow-hidden"
            onClick={() => onOpenLightbox(photoIdx)}
          >
            <img
              src={photo.thumbnail_s3_url || photo.s3_url}
              alt={photo.file_name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          </div>

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1.5 rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
              title="Скачать"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(photo);
              }}
            >
              <Icon name="Download" size={14} />
            </button>
            <button
              className={cn(
                "p-1.5 rounded-md transition-colors",
                deletingPhotoId === photo.id
                  ? "bg-red-600 text-white"
                  : "bg-black/60 text-white hover:bg-red-600"
              )}
              title="Удалить"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(photo.id);
              }}
              disabled={deletingPhotoId === photo.id}
            >
              {deletingPhotoId === photo.id ? (
                <Icon
                  name="Loader2"
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Icon name="Trash2" size={14} />
              )}
            </button>
          </div>

          <div className="p-1.5 sm:p-2">
            <p className="text-[10px] sm:text-xs truncate text-foreground">
              {photo.file_name}
            </p>
            {photo.file_size && (
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                {formatBytes(photo.file_size)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClientUploadPhotoGrid;
