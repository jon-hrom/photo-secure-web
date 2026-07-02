import React, { useEffect } from 'react';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGallery = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyState = any;

interface UseGalleryDerivedArgs {
  gallery: AnyGallery;
  state: AnyState;
  code: string | undefined;
  loadingProgress: number;
  photosLoaded: number;
}

export function useGalleryDerived({
  gallery,
  state,
  code,
  loadingProgress,
  photosLoaded,
}: UseGalleryDerivedArgs) {
  const visiblePhotos = (state.clientData && state.clientData.client_id > 0 && gallery)
    ? gallery.photos.filter((p: Photo) => !state.clientFavoritePhotoIds.includes(p.id))
    : gallery?.photos || [];

  // Оверлей "Подождите" ждёт только ПЕРВЫЕ несколько фото (видимый экран),
  // а не все фото галереи. Остальные подгружаются лениво при прокрутке,
  // поэтому ждать их полную загрузку нельзя — прогресс завис бы навсегда.
  const loadThreshold = Math.min(visiblePhotos.length, 8);

  const actualProgress = loadThreshold > 0
    ? Math.min((photosLoaded / loadThreshold) * 100, 100)
    : loadingProgress;

  useEffect(() => {
    if (loadThreshold > 0 && photosLoaded >= loadThreshold) {
      setTimeout(() => state.setShowProgress(false), 300);

      if (!state.clientData && code) {
        const welcomeShown = localStorage.getItem(`welcome_shown_${code}`);
        if (!welcomeShown) {
          setTimeout(() => state.setIsWelcomeModalOpen(true), 800);
        }
      }
    } else if (loadThreshold > 0 && photosLoaded < loadThreshold) {
      state.setShowProgress(true);
    }
  }, [photosLoaded, loadThreshold, state.clientData, code, state.setShowProgress, state.setIsWelcomeModalOpen]);

  // Аварийный предохранитель: если по какой-то причине фото не досчитались
  // (кэш, ошибки загрузки, ленивая подгрузка) — скрываем оверлей через 4 сек.
  useEffect(() => {
    if (!state.showProgress) return;
    const timer = setTimeout(() => state.setShowProgress(false), 4000);
    return () => clearTimeout(timer);
  }, [state.showProgress, state.setShowProgress]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const bgTheme = gallery?.bg_theme || 'light';
  const isDarkTheme = bgTheme === 'dark' || ((bgTheme === 'custom' || bgTheme === 'auto') && gallery?.bg_color && (() => {
    const hex = gallery.bg_color!.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  })()) || false;

  const galleryBgStyles: React.CSSProperties = {};
  if (bgTheme === 'dark') {
    galleryBgStyles.background = '#1a1a2e';
  } else if (bgTheme === 'auto' && gallery?.bg_color) {
    galleryBgStyles.background = gallery.bg_color;
  } else if (bgTheme === 'custom') {
    if (gallery?.bg_image_url) {
      galleryBgStyles.backgroundImage = `url(${gallery.bg_image_url})`;
      galleryBgStyles.backgroundSize = 'cover';
      galleryBgStyles.backgroundPosition = 'center';
      galleryBgStyles.backgroundAttachment = 'fixed';
    } else if (gallery?.bg_color) {
      galleryBgStyles.background = gallery.bg_color;
    }
  } else {
    galleryBgStyles.background = '#f9fafb';
  }

  const galleryTextColor = gallery?.text_color || (isDarkTheme ? '#ffffff' : '#111827');

  return {
    visiblePhotos,
    loadThreshold,
    actualProgress,
    formatFileSize,
    isDarkTheme,
    galleryBgStyles,
    galleryTextColor,
  };
}
