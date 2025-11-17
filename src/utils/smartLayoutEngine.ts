import type { PhotoSlot } from '@/components/photobook/PhotobookCreator';
import type { FaceBox, PhotoWithFaces } from './faceDetection';

export interface SpreadConfig {
  width: number;
  height: number;
  safeMargin: number;
  spinePosition: number;
  spineWidth: number;
}

export interface PlacedPhoto {
  id: string;
  photoId: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  faces: FaceBox[];
}

const SPINE_SAFE_ZONE = 30;
const MIN_PHOTO_SIZE = 50;
const MAX_ATTEMPTS = 100;

export const isPointInSpineZone = (
  x: number,
  spineCenter: number,
  spineWidth: number
): boolean => {
  const halfZone = (spineWidth + SPINE_SAFE_ZONE * 2) / 2;
  return Math.abs(x - spineCenter) < halfZone;
};

export const doesFaceOverlapSpine = (
  photoX: number,
  photoY: number,
  photoWidth: number,
  photoHeight: number,
  face: FaceBox,
  spineCenter: number,
  spineWidth: number
): boolean => {
  const faceAbsX = photoX + face.x * photoWidth;
  const faceAbsWidth = face.width * photoWidth;
  const faceLeft = faceAbsX;
  const faceRight = faceAbsX + faceAbsWidth;

  const spineLeft = spineCenter - spineWidth / 2 - SPINE_SAFE_ZONE;
  const spineRight = spineCenter + spineWidth / 2 + SPINE_SAFE_ZONE;

  return !(faceRight < spineLeft || faceLeft > spineRight);
};

export const calculatePhotoSize = (
  photoWidth: number,
  photoHeight: number,
  targetWidth: number,
  targetHeight: number,
  coverMode: boolean = true
): { width: number; height: number } => {
  const photoAspect = photoWidth / photoHeight;
  const targetAspect = targetWidth / targetHeight;

  let finalWidth: number;
  let finalHeight: number;

  if (coverMode) {
    if (photoAspect > targetAspect) {
      finalHeight = targetHeight;
      finalWidth = finalHeight * photoAspect;
    } else {
      finalWidth = targetWidth;
      finalHeight = finalWidth / photoAspect;
    }
  } else {
    if (photoAspect > targetAspect) {
      finalWidth = targetWidth;
      finalHeight = finalWidth / photoAspect;
    } else {
      finalHeight = targetHeight;
      finalWidth = finalHeight * photoAspect;
    }
  }

  return { width: finalWidth, height: finalHeight };
};

interface LayoutSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  occupied: boolean;
}

const createGridSlots = (
  spreadConfig: SpreadConfig,
  gridSize: number
): LayoutSlot[] => {
  const slots: LayoutSlot[] = [];
  const safeWidth = spreadConfig.width - spreadConfig.safeMargin * 2;
  const safeHeight = spreadConfig.height - spreadConfig.safeMargin * 2;

  const cols = Math.floor(safeWidth / gridSize);
  const rows = Math.floor(safeHeight / gridSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({
        x: spreadConfig.safeMargin + col * gridSize,
        y: spreadConfig.safeMargin + row * gridSize,
        width: gridSize,
        height: gridSize,
        occupied: false,
      });
    }
  }

  return slots;
};

const findAvailableSpace = (
  slots: LayoutSlot[],
  requiredWidth: number,
  requiredHeight: number,
  spreadConfig: SpreadConfig,
  photo: PhotoWithFaces
): { x: number; y: number } | null => {
  const safeArea = {
    left: spreadConfig.safeMargin,
    right: spreadConfig.width - spreadConfig.safeMargin,
    top: spreadConfig.safeMargin,
    bottom: spreadConfig.height - spreadConfig.safeMargin,
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const x = safeArea.left + Math.random() * (safeArea.right - safeArea.left - requiredWidth);
    const y = safeArea.top + Math.random() * (safeArea.bottom - safeArea.top - requiredHeight);

    if (x < safeArea.left || x + requiredWidth > safeArea.right) continue;
    if (y < safeArea.top || y + requiredHeight > safeArea.bottom) continue;

    let facesAreSafe = true;
    for (const face of photo.faces) {
      if (
        doesFaceOverlapSpine(
          x,
          y,
          requiredWidth,
          requiredHeight,
          face,
          spreadConfig.spinePosition,
          spreadConfig.spineWidth
        )
      ) {
        facesAreSafe = false;
        break;
      }
    }

    if (facesAreSafe) {
      return { x, y };
    }
  }

  return null;
};

const isOverlapping = (
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  placed: PlacedPhoto[],
  minGap: number = 10
): boolean => {
  for (const p of placed) {
    const overlap = !(
      x1 + w1 + minGap < p.x ||
      x1 > p.x + p.width + minGap ||
      y1 + h1 + minGap < p.y ||
      y1 > p.y + p.height + minGap
    );
    if (overlap) return true;
  }
  return false;
};

export const generateSmartLayout = (
  photos: PhotoWithFaces[],
  spreadConfig: SpreadConfig
): PlacedPhoto[] => {
  const placedPhotos: PlacedPhoto[] = [];

  if (photos.length === 0) return placedPhotos;

  const safeWidth = spreadConfig.width - spreadConfig.safeMargin * 2;
  const safeHeight = spreadConfig.height - spreadConfig.safeMargin * 2;

  const photosWithFaces = photos.filter((p) => p.faces.length > 0);
  const photosWithoutFaces = photos.filter((p) => p.faces.length === 0);

  const sortedPhotos = [...photosWithFaces, ...photosWithoutFaces];

  for (let i = 0; i < sortedPhotos.length; i++) {
    const photo = sortedPhotos[i];
    const photoAspect = photo.width / photo.height;
    const isPortrait = photoAspect < 1;
    
    const isLarge = i < Math.min(2, sortedPhotos.length);
    const isMedium = !isLarge && i < Math.min(4, sortedPhotos.length);

    let targetWidth: number;
    let targetHeight: number;

    if (isLarge) {
      targetWidth = isPortrait ? safeWidth * 0.35 : safeWidth * 0.5;
      targetHeight = isPortrait ? safeHeight * 0.6 : safeHeight * 0.45;
    } else if (isMedium) {
      targetWidth = isPortrait ? safeWidth * 0.28 : safeWidth * 0.38;
      targetHeight = isPortrait ? safeHeight * 0.45 : safeHeight * 0.35;
    } else {
      targetWidth = isPortrait ? safeWidth * 0.22 : safeWidth * 0.3;
      targetHeight = isPortrait ? safeHeight * 0.35 : safeHeight * 0.28;
    }

    const size = calculatePhotoSize(
      photo.width,
      photo.height,
      targetWidth,
      targetHeight,
      true
    );

    let position: { x: number; y: number } | null = null;
    let bestAttempts = 0;

    while (bestAttempts < MAX_ATTEMPTS && !position) {
      const safeArea = {
        left: spreadConfig.safeMargin,
        right: spreadConfig.width - spreadConfig.safeMargin - size.width,
        top: spreadConfig.safeMargin,
        bottom: spreadConfig.height - spreadConfig.safeMargin - size.height,
      };

      const tryX = safeArea.left + Math.random() * Math.max(0, safeArea.right - safeArea.left);
      const tryY = safeArea.top + Math.random() * Math.max(0, safeArea.bottom - safeArea.top);

      if (tryX < safeArea.left || tryX + size.width > spreadConfig.width - spreadConfig.safeMargin) {
        bestAttempts++;
        continue;
      }
      if (tryY < safeArea.top || tryY + size.height > spreadConfig.height - spreadConfig.safeMargin) {
        bestAttempts++;
        continue;
      }

      if (isOverlapping(tryX, tryY, size.width, size.height, placedPhotos)) {
        bestAttempts++;
        continue;
      }

      let facesAreSafe = true;
      for (const face of photo.faces) {
        if (
          doesFaceOverlapSpine(
            tryX,
            tryY,
            size.width,
            size.height,
            face,
            spreadConfig.spinePosition,
            spreadConfig.spineWidth
          )
        ) {
          facesAreSafe = false;
          break;
        }
      }

      if (facesAreSafe) {
        position = { x: tryX, y: tryY };
      }

      bestAttempts++;
    }

    if (position) {
      placedPhotos.push({
        id: `placed-${i}`,
        photoId: photo.photoId,
        url: photo.url,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        rotation: 0,
        scale: 1,
        faces: photo.faces,
      });
    }
  }

  return placedPhotos;
};

export const adjustPhotoToAvoidSpine = (
  photo: PlacedPhoto,
  spreadConfig: SpreadConfig
): PlacedPhoto => {
  if (photo.faces.length === 0) return photo;

  const adjusted = { ...photo };
  let attempts = 0;

  while (attempts < 20) {
    let hasOverlap = false;

    for (const face of adjusted.faces) {
      if (
        doesFaceOverlapSpine(
          adjusted.x,
          adjusted.y,
          adjusted.width,
          adjusted.height,
          face,
          spreadConfig.spinePosition,
          spreadConfig.spineWidth
        )
      ) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) break;

    const facesCenterX =
      adjusted.x +
      adjusted.faces.reduce((sum, f) => sum + f.x * adjusted.width + (f.width * adjusted.width) / 2, 0) /
        adjusted.faces.length;

    if (facesCenterX < spreadConfig.spinePosition) {
      adjusted.x -= 20;
    } else {
      adjusted.x += 20;
    }

    if (adjusted.x < spreadConfig.safeMargin) {
      adjusted.x = spreadConfig.safeMargin;
      break;
    }
    if (adjusted.x + adjusted.width > spreadConfig.width - spreadConfig.safeMargin) {
      adjusted.x = spreadConfig.width - spreadConfig.safeMargin - adjusted.width;
      break;
    }

    attempts++;
  }

  return adjusted;
};