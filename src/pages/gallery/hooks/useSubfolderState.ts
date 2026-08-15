import React, { useState, useEffect, useCallback } from 'react';
import { type GallerySubfolder } from '../GalleryGrid';
import { sortPhotosByFilename } from '@/utils/sortPhotosByFilename';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
  s3_key?: string;
  is_video?: boolean;
  content_type?: string;
}

interface ClientUploadFolder {
  id: number;
  folder_name: string;
  client_name: string | null;
  photo_count: number;
  created_at: string | null;
  is_own?: boolean;
}

interface UseSubfolderStateProps {
  code: string | undefined;
  password: string;
  gallery: { client_upload_folders?: ClientUploadFolder[] } | null;
  clientId: number | undefined;
  reloadClientFolders: (clientId: number) => void;
}

export const useSubfolderState = ({
  code,
  password,
  gallery,
  clientId,
  reloadClientFolders,
}: UseSubfolderStateProps) => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [folderToOpen, setFolderToOpen] = useState<{ id: number; folder_name: string } | null>(null);
  const [viewingClientFolder, setViewingClientFolder] = useState<{ id: number; folder_name: string } | null>(null);
  const [viewingSubfolder, setViewingSubfolder] = useState<GallerySubfolder | null>(null);
  const [subfolderPhotos, setSubfolderPhotos] = useState<Photo[]>([]);
  const [subfolderLoading, setSubfolderLoading] = useState(false);
  const [subfolderPasswordRequired, setSubfolderPasswordRequired] = useState(false);
  const [subfolderPassword, setSubfolderPassword] = useState('');
  const [subfolderPasswordError, setSubfolderPasswordError] = useState('');
  const [subfolderFolderName, setSubfolderFolderName] = useState('');
  const [clientUploadFolders, setClientUploadFolders] = useState<ClientUploadFolder[]>(
    gallery?.client_upload_folders || []
  );
  // Фото выбранной папки клиента — показываем их прямо в общей сетке галереи
  const [clientFolderPhotos, setClientFolderPhotos] = useState<Photo[]>([]);
  const [clientFolderLoading, setClientFolderLoading] = useState(false);

  useEffect(() => {
    if (gallery?.client_upload_folders && clientId) {
      setClientUploadFolders(gallery.client_upload_folders);
    }
  }, [gallery?.client_upload_folders]);

  useEffect(() => {
    if (clientId) {
      reloadClientFolders(clientId);
    } else {
      setClientUploadFolders([]);
    }
  }, [clientId]);

  const loadSubfolderPhotos = useCallback(async (subfolder: GallerySubfolder, enteredPassword?: string) => {
    setSubfolderLoading(true);
    try {
      const params = new URLSearchParams({ code: code || '', subfolder_id: String(subfolder.id) });
      if (password) params.set('password', password);
      if (enteredPassword) params.set('subfolder_password', enteredPassword);
      const url = `https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?${params.toString()}`;
      const ownerUid = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
      const res = await fetch(url, { headers: ownerUid ? { 'X-User-Id': ownerUid } : {} });
      const data = await res.json();
      
      if (res.status === 401 && data.requires_password) {
        setSubfolderPasswordRequired(true);
        setSubfolderPasswordError(enteredPassword ? 'Неверный пароль' : '');
        setViewingSubfolder(subfolder);
        return;
      }
      
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      
      setSubfolderPhotos(data.photos ? sortPhotosByFilename(data.photos) : []);
      setSubfolderFolderName(data.folder_name || subfolder.folder_name);
      setViewingSubfolder(subfolder);
      setSubfolderPasswordRequired(false);
      setSubfolderPasswordError('');
    } catch (err) {
      console.error('[SUBFOLDER] Error:', err);
    } finally {
      setSubfolderLoading(false);
    }
  }, [code, password]);

  const handleOpenSubfolder = useCallback((subfolder: GallerySubfolder) => {
    if (subfolder.has_password) {
      setSubfolderPasswordRequired(true);
      setViewingSubfolder(subfolder);
      setSubfolderPassword('');
      setSubfolderPasswordError('');
    } else {
      loadSubfolderPhotos(subfolder);
    }
  }, [loadSubfolderPhotos]);

  const handleSubfolderPasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subfolderPassword.trim() || !viewingSubfolder) return;
    await loadSubfolderPhotos(viewingSubfolder, subfolderPassword);
  }, [subfolderPassword, viewingSubfolder, loadSubfolderPhotos]);

  const handleBackFromSubfolder = useCallback(() => {
    setViewingSubfolder(null);
    setSubfolderPhotos([]);
    setSubfolderPasswordRequired(false);
    setSubfolderPassword('');
    setSubfolderPasswordError('');
    setSubfolderFolderName('');
  }, []);

  /** Открыть папку клиента: подгружаем её фото в общую сетку галереи. */
  const openClientFolder = useCallback(async (
    folder: { id: number; folder_name: string },
    currentClientId?: number,
  ) => {
    if (!code || !currentClientId) return;
    setViewingClientFolder(folder);
    setClientFolderLoading(true);
    setClientFolderPhotos([]);
    try {
      const res = await fetch('https://functions.poehali.dev/06dd3267-2ef6-45bc-899c-50f86e9d36e1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'client_list_photos',
          short_code: code,
          client_id: currentClientId,
          upload_folder_id: folder.id,
        }),
      });
      const data = res.ok ? await res.json() : null;
      const list = (data?.photos || []) as { photo_id: number; file_name: string; s3_url: string }[];
      setClientFolderPhotos(list.map(p => ({
        id: p.photo_id,
        file_name: p.file_name,
        photo_url: p.s3_url,
        thumbnail_url: p.s3_url,
        file_size: 0,
      })) as Photo[]);
    } catch (e) {
      console.error('[CLIENT_FOLDER] load failed', e);
    } finally {
      setClientFolderLoading(false);
    }
  }, [code]);

  const closeClientFolder = useCallback(() => {
    setViewingClientFolder(null);
    setClientFolderPhotos([]);
  }, []);

  return {
    clientFolderPhotos,
    clientFolderLoading,
    openClientFolder,
    closeClientFolder,
    isUploadOpen,
    setIsUploadOpen,
    folderToOpen,
    setFolderToOpen,
    viewingClientFolder,
    setViewingClientFolder,
    viewingSubfolder,
    subfolderPhotos,
    subfolderLoading,
    subfolderPasswordRequired,
    subfolderPassword,
    setSubfolderPassword,
    subfolderPasswordError,
    subfolderFolderName,
    clientUploadFolders,
    setClientUploadFolders,
    handleOpenSubfolder,
    handleSubfolderPasswordSubmit,
    handleBackFromSubfolder,
  };
};

export default useSubfolderState;