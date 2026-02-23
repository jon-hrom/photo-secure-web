import { useState } from 'react';

export interface ClientUploadFolder {
  id: number;
  folder_name: string;
  client_name: string | null;
  photo_count: number;
  created_at: string | null;
  is_own?: boolean;
}

export type UploadStep = 'folders' | 'create' | 'upload' | 'view' | 'rename';

export interface UploadedPhoto {
  photo_id: number;
  file_name: string;
  s3_url: string;
}

export function useClientUploadState() {
  const [step, setStep] = useState<UploadStep>('folders');
  const [viewingOtherFolder, setViewingOtherFolder] = useState(false);
  const [viewerPhotoId, setViewerPhotoId] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [clientName, setClientName] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [activeFolderName, setActiveFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [checkingOwnFolder, setCheckingOwnFolder] = useState(false);

  return {
    step, setStep,
    viewingOtherFolder, setViewingOtherFolder,
    viewerPhotoId, setViewerPhotoId,
    newFolderName, setNewFolderName,
    clientName, setClientName,
    activeFolderId, setActiveFolderId,
    activeFolderName, setActiveFolderName,
    uploading, setUploading,
    uploadProgress, setUploadProgress,
    uploadedPhotos, setUploadedPhotos,
    deletingPhotoId, setDeletingPhotoId,
    renamingFolder, setRenamingFolder,
    renameValue, setRenameValue,
    isDragOver, setIsDragOver,
    loadingPhotos, setLoadingPhotos,
    checkingOwnFolder, setCheckingOwnFolder,
  };
}
