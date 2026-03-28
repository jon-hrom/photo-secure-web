import { useState, useEffect, useCallback } from 'react';
import { GalleryData } from '../GalleryGrid';

export default function useGalleryTheme(gallery: GalleryData) {
  const bgTheme = gallery.bg_theme || 'light';
  const originalIsDark = bgTheme === 'dark' || ((bgTheme === 'custom' || bgTheme === 'auto') && gallery.bg_color && (() => {
    const hex = gallery.bg_color!.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  })());

  const [clientTheme, setClientTheme] = useState<'light' | 'dark' | null>(() => {
    try {
      const saved = localStorage.getItem('gallery-client-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* localStorage unavailable */ }
    return null;
  });

  const isDarkBg = clientTheme !== null ? clientTheme === 'dark' : !!originalIsDark;

  const toggleClientTheme = useCallback(() => {
    const next = isDarkBg ? 'light' : 'dark';
    setClientTheme(next);
    try { localStorage.setItem('gallery-client-theme', next); } catch { /* noop */ }
  }, [isDarkBg]);

  const textColor = isDarkBg ? '#ffffff' : '#111827';
  const secondaryText = isDarkBg ? 'rgba(255,255,255,0.6)' : 'rgba(55,65,81,1)';

  const bgStyles: React.CSSProperties = {};
  if (clientTheme !== null) {
    bgStyles.background = isDarkBg ? '#1a1a2e' : '#f9fafb';
    bgStyles.transition = 'background 0.3s ease';
  } else if (bgTheme === 'dark') {
    bgStyles.background = '#1a1a2e';
  } else if (bgTheme === 'auto' && gallery.bg_color) {
    bgStyles.background = gallery.bg_color;
  } else if (bgTheme === 'custom') {
    if (gallery.bg_image_url) {
      bgStyles.backgroundImage = `url(${gallery.bg_image_url})`;
      bgStyles.backgroundSize = 'cover';
      bgStyles.backgroundPosition = 'center';
      bgStyles.backgroundAttachment = 'fixed';
    } else if (gallery.bg_color) {
      bgStyles.background = gallery.bg_color;
    }
  } else {
    bgStyles.background = '#f9fafb';
  }

  useEffect(() => {
    const themeColor = clientTheme !== null
      ? (isDarkBg ? '#1a1a2e' : '#f9fafb')
      : bgTheme === 'dark' ? '#1a1a2e' 
        : (bgTheme === 'custom' || bgTheme === 'auto') && gallery.bg_color ? gallery.bg_color 
        : '#f9fafb';
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = themeColor;
    return () => { meta.content = '#ffffff'; };
  }, [bgTheme, gallery.bg_color, clientTheme, isDarkBg]);

  return {
    isDarkBg,
    textColor,
    secondaryText,
    bgStyles,
    toggleClientTheme,
  };
}
