import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_URL =
  "https://functions.poehali.dev/06dd3267-2ef6-45bc-899c-50f86e9d36e1";

/* ---------- types ---------- */

interface ClientUploadViewerProps {
  parentFolderId: number;
  userId: number;
}

interface ClientFolder {
  id: number;
  folder_name: string;
  client_name?: string;
  photo_count: number;
  created_at: string;
}

interface ClientPhoto {
  id: number;
  file_name: string;
  s3_url: string;
  thumbnail_s3_url?: string;
  file_size?: number;
  created_at: string;
}

/* ---------- helpers ---------- */

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number) {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/* ---------- sub-components ---------- */

interface LightboxProps {
  photos: ClientPhoto[];
  startIndex: number;
  onClose: () => void;
}

const Lightbox = ({ photos, startIndex, onClose }: LightboxProps) => {
  const [index, setIndex] = useState(startIndex);
  const photo = photos[index];

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  if (!photo) return null;

  const handleDownloadOne = () => {
    const link = document.createElement("a");
    link.href = photo.s3_url;
    link.download = photo.file_name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-white text-sm truncate max-w-[50%]">
          {photo.file_name}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs">
            {index + 1} / {photos.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadOne();
            }}
          >
            <Icon name="Download" size={20} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <Icon name="X" size={20} />
          </Button>
        </div>
      </div>

      {/* image */}
      <img
        src={photo.s3_url}
        alt={photo.file_name}
        className="max-h-[85vh] max-w-[90vw] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* prev / next */}
      {photos.length > 1 && (
        <>
          <button
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
          >
            <Icon name="ChevronLeft" size={28} />
          </button>
          <button
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
          >
            <Icon name="ChevronRight" size={28} />
          </button>
        </>
      )}
    </div>
  );
};

/* ---------- main component ---------- */

const ClientUploadViewer = ({
  parentFolderId,
  userId,
}: ClientUploadViewerProps) => {
  const { toast } = useToast();

  const [folders, setFolders] = useState<ClientFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // photos keyed by folder id
  const [photosMap, setPhotosMap] = useState<Record<number, ClientPhoto[]>>({});
  const [photosLoading, setPhotosLoading] = useState<Record<number, boolean>>(
    {}
  );

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(null);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<
    number | null
  >(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);

  // lightbox
  const [lightbox, setLightbox] = useState<{
    folderId: number;
    index: number;
  } | null>(null);

  /* -- fetch folders -- */
  const fetchFolders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_URL}?action=photographer_folders&parent_folder_id=${parentFolderId}`,
        { headers: { "X-User-Id": userId.toString() } }
      );
      if (!res.ok) throw new Error("Failed to fetch folders");
      const data = await res.json();
      setFolders(Array.isArray(data) ? data : data.folders ?? []);
    } catch {
      // silently fail - component will just be hidden
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [parentFolderId, userId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  /* -- fetch photos for a folder -- */
  const fetchPhotos = useCallback(
    async (folderId: number) => {
      if (photosMap[folderId]) return; // already fetched
      try {
        setPhotosLoading((prev) => ({ ...prev, [folderId]: true }));
        const res = await fetch(
          `${API_URL}?action=photographer_photos&upload_folder_id=${folderId}`,
          { headers: { "X-User-Id": userId.toString() } }
        );
        if (!res.ok) throw new Error("Failed to fetch photos");
        const data = await res.json();
        setPhotosMap((prev) => ({
          ...prev,
          [folderId]: Array.isArray(data) ? data : data.photos ?? [],
        }));
      } catch {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить фото клиента",
          variant: "destructive",
        });
      } finally {
        setPhotosLoading((prev) => ({ ...prev, [folderId]: false }));
      }
    },
    [userId, photosMap, toast]
  );

  /* -- toggle expand -- */
  const toggleExpand = (folderId: number) => {
    if (expandedId === folderId) {
      setExpandedId(null);
    } else {
      setExpandedId(folderId);
      fetchPhotos(folderId);
    }
  };

  /* -- download all -- */
  const downloadAll = async (uploadFolderId: number) => {
    try {
      setDownloadingId(uploadFolderId);
      const res = await fetch(
        `${API_URL}?action=photographer_download&upload_folder_id=${uploadFolderId}`,
        { headers: { "X-User-Id": userId.toString() } }
      );
      if (!res.ok) throw new Error("Download failed");
      const data = await res.json();

      if (!data.files?.length) {
        toast({ title: "Нет файлов для скачивания" });
        return;
      }

      toast({
        title: "Скачивание",
        description: `Начинается скачивание ${data.totalFiles ?? data.files.length} файлов...`,
      });

      for (const file of data.files) {
        const link = document.createElement("a");
        link.href = file.url;
        link.download = file.filename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось скачать файлы",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  /* -- delete folder -- */
  const deleteFolder = async (folderId: number) => {
    try {
      setDeletingFolderId(folderId);
      const res = await fetch(`${API_URL}?upload_folder_id=${folderId}`, {
        method: "DELETE",
        headers: { "X-User-Id": userId.toString() },
      });
      if (!res.ok) throw new Error("Delete failed");
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setPhotosMap((prev) => {
        const copy = { ...prev };
        delete copy[folderId];
        return copy;
      });
      if (expandedId === folderId) setExpandedId(null);
      setConfirmDeleteFolderId(null);
      toast({ title: "Папка клиента удалена" });
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить папку",
        variant: "destructive",
      });
    } finally {
      setDeletingFolderId(null);
    }
  };

  /* -- delete single photo -- */
  const deletePhoto = async (photoId: number, folderId: number) => {
    try {
      setDeletingPhotoId(photoId);
      const res = await fetch(`${API_URL}?photo_id=${photoId}`, {
        method: "DELETE",
        headers: { "X-User-Id": userId.toString() },
      });
      if (!res.ok) throw new Error("Delete failed");
      setPhotosMap((prev) => ({
        ...prev,
        [folderId]: (prev[folderId] ?? []).filter((p) => p.id !== photoId),
      }));
      // decrement folder photo count
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? { ...f, photo_count: Math.max(0, f.photo_count - 1) }
            : f
        )
      );
      toast({ title: "Фото удалено" });
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить фото",
        variant: "destructive",
      });
    } finally {
      setDeletingPhotoId(null);
    }
  };

  /* -- download single photo -- */
  const downloadSingle = (photo: ClientPhoto) => {
    const link = document.createElement("a");
    link.href = photo.s3_url;
    link.download = photo.file_name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ---------- render ---------- */

  // show nothing while loading or when no folders
  if (loading) {
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

  if (folders.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* section header */}
      <div className="flex items-center gap-2 px-1">
        <Icon name="UserPlus" size={18} className="text-teal-500" />
        <h3 className="text-sm font-semibold text-foreground">
          Загрузки от клиентов
        </h3>
        <span className="text-xs text-muted-foreground">
          ({folders.length})
        </span>
      </div>

      {folders.map((folder) => {
        const isExpanded = expandedId === folder.id;
        const photos = photosMap[folder.id] ?? [];
        const isPhotosLoading = photosLoading[folder.id] ?? false;

        return (
          <div
            key={folder.id}
            className={cn(
              "rounded-lg border transition-colors",
              "border-teal-200 dark:border-teal-800 bg-card"
            )}
          >
            {/* folder header card */}
            <button
              type="button"
              className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-colors rounded-t-lg"
              onClick={() => toggleExpand(folder.id)}
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

            {/* action buttons row (always visible beneath header) */}
            <div className="flex items-center gap-2 px-3 sm:px-4 pb-3 border-t border-teal-100 dark:border-teal-800/50 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={downloadingId === folder.id}
                onClick={(e) => {
                  e.stopPropagation();
                  downloadAll(folder.id);
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
                      deleteFolder(folder.id);
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
                      setConfirmDeleteFolderId(null);
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
                    setConfirmDeleteFolderId(folder.id);
                  }}
                >
                  <Icon name="Trash2" size={14} />
                  <span className="hidden sm:inline">Удалить папку</span>
                </Button>
              )}
            </div>

            {/* expanded photo grid */}
            {isExpanded && (
              <div className="border-t border-teal-100 dark:border-teal-800/50 p-3 sm:p-4">
                {isPhotosLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Icon
                      name="Loader2"
                      size={24}
                      className="animate-spin text-muted-foreground"
                    />
                  </div>
                ) : photos.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Icon
                      name="ImageOff"
                      size={32}
                      className="mx-auto mb-2 opacity-50"
                    />
                    <p className="text-sm">Нет фотографий</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                    {photos.map((photo, photoIdx) => (
                      <div
                        key={photo.id}
                        className="group relative rounded-lg overflow-hidden border border-border bg-muted/30"
                      >
                        {/* thumbnail */}
                        <div
                          className="aspect-square cursor-pointer overflow-hidden"
                          onClick={() =>
                            setLightbox({
                              folderId: folder.id,
                              index: photoIdx,
                            })
                          }
                        >
                          <img
                            src={photo.thumbnail_s3_url || photo.s3_url}
                            alt={photo.file_name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>

                        {/* overlay actions (visible on hover / touch) */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />
                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1.5 rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
                            title="Скачать"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadSingle(photo);
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
                              deletePhoto(photo.id, folder.id);
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

                        {/* filename + size */}
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
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* lightbox */}
      {lightbox && photosMap[lightbox.folderId] && (
        <Lightbox
          photos={photosMap[lightbox.folderId]}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
};

export default ClientUploadViewer;
