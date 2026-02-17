import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { formatDate } from "./types";
import type { ClientFolder, ClientPhoto } from "./types";
import ClientUploadPhotoGrid from "./ClientUploadPhotoGrid";

interface ClientUploadFolderCardProps {
  folder: ClientFolder;
  isExpanded: boolean;
  photos: ClientPhoto[];
  isPhotosLoading: boolean;
  downloadingId: number | null;
  deletingPhotoId: number | null;
  confirmDeleteFolderId: number | null;
  deletingFolderId: number | null;
  onToggleExpand: (folderId: number) => void;
  onDownloadAll: (folderId: number) => void;
  onDeleteFolder: (folderId: number) => void;
  onConfirmDeleteFolder: (folderId: number | null) => void;
  onDeletePhoto: (photoId: number, folderId: number) => void;
  onDownloadSingle: (photo: ClientPhoto) => void;
  onOpenLightbox: (folderId: number, index: number) => void;
}

const ClientUploadFolderCard = ({
  folder,
  isExpanded,
  photos,
  isPhotosLoading,
  downloadingId,
  deletingPhotoId,
  confirmDeleteFolderId,
  deletingFolderId,
  onToggleExpand,
  onDownloadAll,
  onDeleteFolder,
  onConfirmDeleteFolder,
  onDeletePhoto,
  onDownloadSingle,
  onOpenLightbox,
}: ClientUploadFolderCardProps) => {
  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        "border-teal-200 dark:border-teal-800 bg-card"
      )}
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-colors rounded-t-lg"
        onClick={() => onToggleExpand(folder.id)}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
          <Icon
            name="FolderHeart"
            size={20}
            className="text-teal-600 dark:text-teal-400"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">
              {folder.folder_name}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300">
              От клиента
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {folder.client_name && (
              <span className="flex items-center gap-1">
                <Icon name="User" size={12} />
                {folder.client_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Icon name="Image" size={12} />
              {folder.photo_count} фото
            </span>
            <span className="hidden sm:inline">
              {formatDate(folder.created_at)}
            </span>
          </div>
        </div>

        <Icon
          name={isExpanded ? "ChevronUp" : "ChevronDown"}
          size={18}
          className="text-muted-foreground flex-shrink-0"
        />
      </button>

      <div className="flex items-center gap-2 px-3 sm:px-4 pb-3 border-t border-teal-100 dark:border-teal-800/50 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled={downloadingId === folder.id}
          onClick={(e) => {
            e.stopPropagation();
            onDownloadAll(folder.id);
          }}
        >
          {downloadingId === folder.id ? (
            <Icon name="Loader2" size={14} className="animate-spin" />
          ) : (
            <Icon name="Download" size={14} />
          )}
          <span className="hidden sm:inline">Скачать все</span>
          <span className="sm:hidden">Скачать</span>
        </Button>

        {confirmDeleteFolderId === folder.id ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs gap-1"
              disabled={deletingFolderId === folder.id}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder.id);
              }}
            >
              {deletingFolderId === folder.id ? (
                <Icon
                  name="Loader2"
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Icon name="Trash2" size={14} />
              )}
              Да, удалить
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmDeleteFolder(null);
              }}
            >
              Отмена
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onConfirmDeleteFolder(folder.id);
            }}
          >
            <Icon name="Trash2" size={14} />
            <span className="hidden sm:inline">Удалить папку</span>
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-teal-100 dark:border-teal-800/50 p-3 sm:p-4">
          <ClientUploadPhotoGrid
            photos={photos}
            isLoading={isPhotosLoading}
            deletingPhotoId={deletingPhotoId}
            onOpenLightbox={(index) => onOpenLightbox(folder.id, index)}
            onDownload={onDownloadSingle}
            onDelete={(photoId) => onDeletePhoto(photoId, folder.id)}
          />
        </div>
      )}
    </div>
  );
};

export default ClientUploadFolderCard;
