import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GalleryPhotoCard from './GalleryPhotoCard';
import { Photo, WatermarkSettings } from '../GalleryGrid';

interface GalleryJustifiedLayoutProps {
  photos: Photo[];
  gridGap: number;
  isDarkBg: boolean;
  screenshotProtection?: boolean;
  downloadDisabled?: boolean;
  watermark?: WatermarkSettings;
  onPhotoClick: (photo: Photo) => void;
  onDownloadPhoto: (photo: Photo) => void;
  onAddToFavorites: (photo: Photo) => void;
  onPhotoLoad?: () => void;
  selectionMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (photo: Photo) => void;
}

export default function GalleryJustifiedLayout({
  photos,
  gridGap,
  isDarkBg,
  screenshotProtection,
  downloadDisabled,
  watermark,
  onPhotoClick,
  onDownloadPhoto,
  onAddToFavorites,
  onPhotoLoad,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: GalleryJustifiedLayoutProps) {
  const pendingNodes = useRef<Set<HTMLDivElement>>(new Set());
  const animatedSet = useRef<Set<Element>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const getObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !animatedSet.current.has(entry.target)) {
              animatedSet.current.add(entry.target);
              const el = entry.target as HTMLElement;
              el.style.opacity = '1';
              el.style.transform = 'translateY(0)';
            }
          });
        },
        { threshold: 0, rootMargin: '400px' }
      );
      pendingNodes.current.forEach(n => observerRef.current!.observe(n));
      pendingNodes.current.clear();
    }
    return observerRef.current;
  }, []);

  useEffect(() => {
    getObserver();
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [getObserver]);

  const photoCardRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    if (observerRef.current) {
      observerRef.current.observe(node);
    } else {
      pendingNodes.current.add(node);
    }
  }, []);

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      const re = /(\d+)|(\D+)/g;
      const aParts = a.file_name.toLowerCase().match(re) || [];
      const bParts = b.file_name.toLowerCase().match(re) || [];
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        if (i >= aParts.length) return -1;
        if (i >= bParts.length) return 1;
        const aNum = parseInt(aParts[i]);
        const bNum = parseInt(bParts[i]);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) return aNum - bNum;
        } else {
          const cmp = aParts[i].localeCompare(bParts[i]);
          if (cmp !== 0) return cmp;
        }
      }
      return 0;
    });
  }, [photos]);

  const RAW_EXTS = ['.cr2', '.nef', '.arw', '.dng', '.orf', '.raf', '.rw2', '.cr3'];
  const isRaw = (p: Photo) => RAW_EXTS.some(ext => p.file_name.toLowerCase().endsWith(ext));
  const allRaw = sortedPhotos.length > 0 && sortedPhotos.every(isRaw);

  // Для RAW-файлов без метаданных — определяем ориентацию по thumbnail
  const [detectedRatios, setDetectedRatios] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!allRaw) return;
    const missing = sortedPhotos.filter(p => !p.width || !p.height);
    if (missing.length === 0) return;

    missing.forEach(p => {
      const src = p.thumbnail_url || p.photo_url;
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setDetectedRatios(prev => ({
            ...prev,
            [p.id]: img.naturalWidth / img.naturalHeight,
          }));
        }
      };
      img.src = src;
    });
  }, [allRaw, sortedPhotos]);

  const getAR = (p: Photo): number => {
    if (p.width && p.height) return p.width / p.height;
    if (detectedRatios[p.id]) return detectedRatios[p.id];
    // Пока thumbnail не загрузился — считаем горизонтальным (3:2 типично для зеркалки)
    return 3 / 2;
  };

  const isLandscapePhoto = (p: Photo) => getAR(p) > 1.15;

  const targetHeight = 280;
  const containerWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 32, 1280) : 1200;

  const justifiedRows: { photos: Photo[]; height: number }[] = [];

  if (allRaw) {
    // RAW-режим: горизонтальные — по 1 на всю ширину, вертикальные — по 2 рядом
    let i = 0;
    while (i < sortedPhotos.length) {
      const photo = sortedPhotos[i];
      if (isLandscapePhoto(photo)) {
        // Горизонтальное: одно на всю строку
        justifiedRows.push({ photos: [photo], height: containerWidth / getAR(photo) });
        i++;
      } else {
        // Вертикальное: берём до 2 подряд вертикальных
        const verticals: Photo[] = [photo];
        if (i + 1 < sortedPhotos.length && !isLandscapePhoto(sortedPhotos[i + 1])) {
          verticals.push(sortedPhotos[i + 1]);
        }
        const totalAR = verticals.reduce((s, p) => s + getAR(p), 0);
        const gaps = (verticals.length - 1) * gridGap;
        const h = (containerWidth - gaps) / totalAR;
        justifiedRows.push({ photos: verticals, height: h });
        i += verticals.length;
      }
    }
  } else {
    let currentRow: Photo[] = [];
    let currentAR = 0;

    sortedPhotos.forEach((photo, i) => {
      const ar = (photo.width || 1) / (photo.height || 1);
      currentRow.push(photo);
      currentAR += ar;

      const gaps = currentRow.length > 1 ? (currentRow.length - 1) * gridGap : 0;
      const rowHeight = (containerWidth - gaps) / currentAR;

      if (rowHeight <= targetHeight || i === sortedPhotos.length - 1) {
        const finalHeight = i === sortedPhotos.length - 1 && rowHeight > targetHeight * 1.5
          ? targetHeight
          : rowHeight;
        justifiedRows.push({ photos: [...currentRow], height: finalHeight });
        currentRow = [];
        currentAR = 0;
      }
    });
  }

  let globalIndex = 0;
  return (
    <>
      {justifiedRows.map((row, rowIdx) => {
        const gaps = row.photos.length > 1 ? (row.photos.length - 1) * gridGap : 0;
        const availW = containerWidth - gaps;
        const totalAR = row.photos.reduce((sum, p) => sum + getAR(p), 0);

        return (
          <div key={`row-${rowIdx}`} className="flex" style={{ gap: `${gridGap}px`, marginBottom: `${gridGap}px` }}>
            {row.photos.map(photo => {
              const ar = getAR(photo);
              const w = (ar / totalAR) * availW;
              const idx = globalIndex++;
              const isL = ar > 1.15;
              return (
                <div key={photo.id} style={{ width: `${(w / containerWidth) * 100}%`, flexShrink: 0, flexGrow: 1 }}>
                  <GalleryPhotoCard ref={photoCardRef} photo={photo} index={idx} gridGap={0} isDarkBg={isDarkBg}
                    screenshotProtection={screenshotProtection} downloadDisabled={downloadDisabled}
                    watermark={watermark} onPhotoClick={onPhotoClick} onDownloadPhoto={onDownloadPhoto}
                    onAddToFavorites={onAddToFavorites} onPhotoLoad={onPhotoLoad} selectionMode={selectionMode}
                    isSelected={selectedIds.has(photo.id)} onToggleSelect={onToggleSelect} isLandscape={isL} />
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}