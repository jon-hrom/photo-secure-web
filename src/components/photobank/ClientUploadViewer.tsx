import { useState, useEffect, useCallback } from "react";
import * as zip from "@zip.js/zip.js";
import Icon from "@/components/ui/icon";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "./client-upload/types";
import type { ClientFolder, ClientPhoto } from "./client-upload/types";
import ClientUploadLightbox from "./client-upload/ClientUploadLightbox";
import ClientUploadFolderCard from "./client-upload/ClientUploadFolderCard";

interface ClientUploadViewerProps {
  parentFolderId: number;
  userId: number;
}

const ClientUploadViewer = ({
  parentFolderId,
  userId,
}: ClientUploadViewerProps) => {
  const { toast } = useToast();

  const [folders, setFolders] = useState<ClientFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const [lightbox, setLightbox] = useState<{
    folderId: number;
    index: number;
  } | null>(null);

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
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [parentFolderId, userId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const fetchPhotos = useCallback(
    async (folderId: number) => {
      if (photosMap[folderId]) return;
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

  const toggleExpand = (folderId: number) => {
    if (expandedId === folderId) {
      setExpandedId(null);
    } else {
      setExpandedId(folderId);
      fetchPhotos(folderId);
    }
  };

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

      const totalFiles = data.totalFiles ?? data.files.length;
      toast({
        title: "Создание архива",
        description: `Скачивание 0/${totalFiles} файлов...`,
      });

      const blobWriter = new zip.BlobWriter("application/zip");
      const zipWriter = new zip.ZipWriter(blobWriter);

      for (let i = 0; i < data.files.length; i++) {
        const file = data.files[i];
        try {
          const fileRes = await fetch(file.url);
          const blob = await fileRes.blob();
          await zipWriter.add(file.filename, new zip.BlobReader(blob), {
            level: 0,
          });
        } catch {
          // skip failed files
        }
        if ((i + 1) % 3 === 0 || i === data.files.length - 1) {
          toast({
            title: "Создание архива",
            description: `Скачивание ${i + 1}/${totalFiles} файлов...`,
          });
        }
      }

      const zipBlob = await zipWriter.close();

      const folderObj = folders.find((f) => f.id === uploadFolderId);
      const zipName = folderObj
        ? `${folderObj.folder_name}.zip`
        : `client_photos_${uploadFolderId}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Готово",
        description: `Архив ${zipName} скачан`,
      });
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

  const downloadSingle = async (photo: ClientPhoto) => {
    try {
      const res = await fetch(photo.s3_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = photo.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      const link = document.createElement("a");
      link.href = photo.s3_url;
      link.download = photo.file_name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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
      <div className="flex items-center gap-2 px-1">
        <Icon name="UserPlus" size={18} className="text-teal-500" />
        <h3 className="text-sm font-semibold text-foreground">
          Загрузки от клиентов
        </h3>
        <span className="text-xs text-muted-foreground">
          ({folders.length})
        </span>
      </div>

      {folders.map((folder) => (
        <ClientUploadFolderCard
          key={folder.id}
          folder={folder}
          isExpanded={expandedId === folder.id}
          photos={photosMap[folder.id] ?? []}
          isPhotosLoading={photosLoading[folder.id] ?? false}
          downloadingId={downloadingId}
          deletingPhotoId={deletingPhotoId}
          confirmDeleteFolderId={confirmDeleteFolderId}
          deletingFolderId={deletingFolderId}
          onToggleExpand={toggleExpand}
          onDownloadAll={downloadAll}
          onDeleteFolder={deleteFolder}
          onConfirmDeleteFolder={setConfirmDeleteFolderId}
          onDeletePhoto={deletePhoto}
          onDownloadSingle={downloadSingle}
          onOpenLightbox={(folderId, index) =>
            setLightbox({ folderId, index })
          }
        />
      ))}

      {lightbox && photosMap[lightbox.folderId] && (
        <ClientUploadLightbox
          photos={photosMap[lightbox.folderId]}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
};

export default ClientUploadViewer;
