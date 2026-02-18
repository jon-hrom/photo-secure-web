import { useState, useEffect } from 'react';

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
  folder_id?: number;
}

interface WatermarkSettings {
  enabled: boolean;
  type: string;
  text?: string;
  image_url?: string;
  frequency: number;
  size: number;
  opacity: number;
  rotation?: number;
}

interface FavoriteConfig {
  id: string;
  name: string;
  fields: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
}

interface GalleryData {
  folder_name: string;
  photos: Photo[];
  total_size: number;
  watermark?: WatermarkSettings;
  screenshot_protection?: boolean;
  download_disabled?: boolean;
  favorite_config?: FavoriteConfig | null;
  photographer_timezone?: string;
  cover_photo_id?: number | null;
  cover_orientation?: string;
  cover_focus_x?: number;
  cover_focus_y?: number;
  grid_gap?: number;
  mobile_cover_photo_id?: number | null;
  mobile_cover_focus_x?: number;
  mobile_cover_focus_y?: number;
  client_upload_enabled?: boolean;
  client_upload_folders?: Array<{
    id: number;
    folder_name: string;
    client_name: string | null;
    photo_count: number;
    created_at: string | null;
  }>;
  link_id?: number;
}

export function useGalleryLoader(code?: string) {
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [photosLoaded, setPhotosLoaded] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [photographerEmail, setPhotographerEmail] = useState('');

  const loadGallery = async (enteredPassword?: string) => {
    console.log('[PUBLIC_GALLERY] Loading gallery, password provided:', !!enteredPassword);
    try {
      const passwordParam = enteredPassword || password;
      const url = passwordParam 
        ? `https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?code=${code}&password=${encodeURIComponent(passwordParam)}`
        : `https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?code=${code}`;
      
      console.log('[PUBLIC_GALLERY] Fetching URL:', url);
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[PUBLIC_GALLERY] Response status:', response.status, 'Data:', data);
      
      if (response.status === 401 && data.requires_password) {
        console.log('[PUBLIC_GALLERY] Password required');
        setRequiresPassword(true);
        setPasswordError(enteredPassword ? 'Неверный пароль' : '');
        setLoading(false);
        return;
      }
      
      if (response.status === 403 && data.blocked) {
        console.log('[PUBLIC_GALLERY] Gallery link is blocked');
        setIsBlocked(true);
        setPhotographerEmail(data.photographer_email || '');
        setLoading(false);
        return;
      }
      
      if (response.status === 410 && data.expired) {
        console.log('[PUBLIC_GALLERY] Gallery link expired');
        setIsBlocked(true);
        setPhotographerEmail(data.photographer_email || '');
        setLoading(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Галерея не найдена');
      }
      
      console.log('[PUBLIC_GALLERY] Gallery loaded successfully, photos:', data.photos?.length);
      setGallery(data);
      setRequiresPassword(false);
      setPasswordError('');
      
      if (data.photos && data.photos.length > 0) {
        setPhotosLoaded(0);
        setLoadingProgress(0);
      }
    } catch (err: any) {
      console.error('[PUBLIC_GALLERY] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[PUBLIC_GALLERY] Component mounted, code:', code);
    loadGallery();
  }, [code]);

  useEffect(() => {
    if (gallery && gallery.photos.length > 0) {
      const progressPercent = Math.min((photosLoaded / gallery.photos.length) * 100, 100);
      setLoadingProgress(progressPercent);
      
      // Скрываем прогресс-бар когда все фото загружены
      if (photosLoaded >= gallery.photos.length) {
        setTimeout(() => setLoadingProgress(0), 500);
      }
    }
  }, [photosLoaded, gallery]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[PUBLIC_GALLERY] Password submit, value:', password);
    if (!password.trim()) {
      setPasswordError('Введите пароль');
      return;
    }
    setLoading(true);
    setPasswordError('');
    await loadGallery(password);
  };

  return {
    gallery,
    loading,
    error,
    requiresPassword,
    password,
    passwordError,
    loadingProgress,
    photosLoaded,
    isBlocked,
    photographerEmail,
    setPassword,
    setPhotosLoaded,
    handlePasswordSubmit
  };
}