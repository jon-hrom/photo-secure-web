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
    setClientTheme(prev => {
      const current = prev !== null ? prev === 'dark' : !!originalIsDark;
      const next: 'light' | 'dark' = current ? 'light' : 'dark';
      try { localStorage.setItem('gallery-client-theme', next); } catch { /* noop */ }
      return next;
    });
  }, [originalIsDark]);

  const textColor = isDarkBg ? '#ffffff' : '#111827';
  const secondaryText = isDarkBg ? 'rgba(255,255,255,0.6)' : 'rgba(55,65,81,1)';

  const bgStyles: React.CSSProperties = {};
  if (clientTheme !== null) {
    bgStyles.background = isDarkBg ? '#000000' : '#ffffff';
    bgStyles.transition = 'background 0.3s ease';
  } else if (bgTheme === 'dark') {
    bgStyles.background = '#000000';
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
    bgStyles.background = '#ffffff';
  }

  useEffect(() => {
    const themeColor = clientTheme !== null
      ? (isDarkBg ? '#000000' : '#ffffff')
      : bgTheme === 'dark' ? '#000000' 
        : (bgTheme === 'custom' || bgTheme === 'auto') && gallery.bg_color ? gallery.bg_color 
        : '#ffffff';

    const head = document.head;
    const root = document.documentElement;
    const body = document.body;

    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    themeMeta.content = themeColor;
    head.appendChild(themeMeta);

    const themeMetaLight = document.createElement('meta');
    themeMetaLight.name = 'theme-color';
    themeMetaLight.setAttribute('media', '(prefers-color-scheme: light)');
    themeMetaLight.content = themeColor;
    head.appendChild(themeMetaLight);

    const themeMetaDark = document.createElement('meta');
    themeMetaDark.name = 'theme-color';
    themeMetaDark.setAttribute('media', '(prefers-color-scheme: dark)');
    themeMetaDark.content = themeColor;
    head.appendChild(themeMetaDark);

    document.querySelectorAll('meta[name="color-scheme"]').forEach(m => m.remove());
    const csMeta = document.createElement('meta');
    csMeta.name = 'color-scheme';
    csMeta.content = isDarkBg ? 'dark' : 'light';
    head.appendChild(csMeta);

    document.querySelectorAll('meta[name="apple-mobile-web-app-status-bar-style"]').forEach(m => m.remove());
    const iosMeta = document.createElement('meta');
    iosMeta.name = 'apple-mobile-web-app-status-bar-style';
    iosMeta.content = isDarkBg ? 'black-translucent' : 'default';
    head.appendChild(iosMeta);

    const prevHadDark = root.classList.contains('dark');

    if (isDarkBg) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    root.style.setProperty('color-scheme', isDarkBg ? 'dark' : 'light');
    root.style.setProperty('background-color', isDarkBg ? '#000000' : '#ffffff', 'important');
    body.style.setProperty('background-color', isDarkBg ? '#000000' : '#ffffff', 'important');
    body.style.setProperty('color', isDarkBg ? '#ffffff' : '#111827', 'important');

    return () => {
      themeMeta.remove();
      themeMetaLight.remove();
      themeMetaDark.remove();
      csMeta.remove();
      iosMeta.remove();
      if (prevHadDark) root.classList.add('dark'); else root.classList.remove('dark');
      root.style.removeProperty('color-scheme');
      root.style.removeProperty('background-color');
      body.style.removeProperty('background-color');
      body.style.removeProperty('color');
    };
  }, [bgTheme, gallery.bg_color, clientTheme, isDarkBg]);

  return {
    isDarkBg,
    textColor,
    secondaryText,
    bgStyles,
    toggleClientTheme,
  };
}