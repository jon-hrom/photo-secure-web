import { useState } from 'react';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface Photo {
  id: number;
  file_name: string;
  s3_url: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export const usePhotoBankState = () => {
  const [folders, setFolders] = useState<PhotoFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<PhotoFolder | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, percent: 0, currentFileName: '' });
  const [uploadCancelled, setUploadCancelled] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ usedGb: 0, limitGb: 5, percent: 0 });

  return {
    folders,
    setFolders,
    selectedFolder,
    setSelectedFolder,
    photos,
    setPhotos,
    loading,
    setLoading,
    uploading,
    setUploading,
    uploadProgress,
    setUploadProgress,
    uploadCancelled,
    setUploadCancelled,
    showCreateFolder,
    setShowCreateFolder,
    showClearConfirm,
    setShowClearConfirm,
    folderName,
    setFolderName,
    selectedPhotos,
    setSelectedPhotos,
    selectionMode,
    setSelectionMode,
    storageUsage,
    setStorageUsage
  };
};