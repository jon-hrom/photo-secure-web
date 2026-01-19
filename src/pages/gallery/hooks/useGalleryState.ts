import { useState, useRef } from 'react';

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

interface FavoriteFolder {
  id: string;
  name: string;
  fields: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
  photoCount: number;
  photos: Photo[];
}

export function useGalleryState() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [favoriteFolder, setFavoriteFolder] = useState<FavoriteFolder | null>(null);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [photoToAdd, setPhotoToAdd] = useState<Photo | null>(null);
  const [clientData, setClientData] = useState<{ client_id: number; full_name: string; phone: string; email?: string } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMyFavoritesOpen, setIsMyFavoritesOpen] = useState(false);
  const [clientFavoritePhotoIds, setClientFavoritePhotoIds] = useState<number[]>([]);
  const [viewingFavorites, setViewingFavorites] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProgress, setShowProgress] = useState(true);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const previousUnreadCount = useRef<number>(0);

  return {
    selectedPhoto,
    setSelectedPhoto,
    favoriteFolder,
    setFavoriteFolder,
    isFavoritesModalOpen,
    setIsFavoritesModalOpen,
    photoToAdd,
    setPhotoToAdd,
    clientData,
    setClientData,
    isLoginModalOpen,
    setIsLoginModalOpen,
    isMyFavoritesOpen,
    setIsMyFavoritesOpen,
    clientFavoritePhotoIds,
    setClientFavoritePhotoIds,
    viewingFavorites,
    setViewingFavorites,
    isChatOpen,
    setIsChatOpen,
    unreadCount,
    setUnreadCount,
    showProgress,
    setShowProgress,
    isWelcomeModalOpen,
    setIsWelcomeModalOpen,
    previousUnreadCount
  };
}
