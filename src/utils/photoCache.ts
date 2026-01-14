interface CachedPhoto {
  id: number;
  photo_url: string;
  thumbnail_url: string;
  cached_at: number;
  expires_at: number;
}

interface PhotoCache {
  [folderId: number]: {
    photos: CachedPhoto[];
    cached_at: number;
  };
}

const CACHE_DURATION = 50 * 60 * 1000;
const memoryCache: PhotoCache = {};

export function getCachedPhotos(folderId: number): CachedPhoto[] | null {
  const cache = memoryCache[folderId];
  
  if (!cache) {
    console.log(`[PHOTO_CACHE] No cache for folder ${folderId}`);
    return null;
  }

  const now = Date.now();
  const isCacheValid = (now - cache.cached_at) < CACHE_DURATION;

  if (!isCacheValid) {
    console.log(`[PHOTO_CACHE] Cache expired for folder ${folderId}`);
    delete memoryCache[folderId];
    return null;
  }

  const validPhotos = cache.photos.filter(p => p.expires_at > now);
  
  if (validPhotos.length !== cache.photos.length) {
    console.log(`[PHOTO_CACHE] Some URLs expired, refreshing cache for folder ${folderId}`);
    delete memoryCache[folderId];
    return null;
  }

  console.log(`[PHOTO_CACHE] Using cached photos for folder ${folderId}: ${validPhotos.length} items`);
  return validPhotos;
}

export function setCachedPhotos(folderId: number, photos: any[]): void {
  const now = Date.now();
  
  const cachedPhotos: CachedPhoto[] = photos.map(photo => {
    const urlExpiresMatch = photo.photo_url.match(/Expires=(\d+)/);
    const expiresTimestamp = urlExpiresMatch ? parseInt(urlExpiresMatch[1]) * 1000 : now + CACHE_DURATION;

    return {
      id: photo.id,
      photo_url: photo.photo_url,
      thumbnail_url: photo.thumbnail_url || photo.photo_url,
      cached_at: now,
      expires_at: expiresTimestamp
    };
  });

  memoryCache[folderId] = {
    photos: cachedPhotos,
    cached_at: now
  };

  console.log(`[PHOTO_CACHE] Cached ${cachedPhotos.length} photos for folder ${folderId}`);
}

export function clearCache(folderId?: number): void {
  if (folderId) {
    delete memoryCache[folderId];
    console.log(`[PHOTO_CACHE] Cleared cache for folder ${folderId}`);
  } else {
    Object.keys(memoryCache).forEach(key => delete memoryCache[parseInt(key)]);
    console.log(`[PHOTO_CACHE] Cleared all cache`);
  }
}

export function getCacheStats(): { folders: number; totalPhotos: number } {
  const folders = Object.keys(memoryCache).length;
  const totalPhotos = Object.values(memoryCache).reduce(
    (sum, cache) => sum + cache.photos.length,
    0
  );
  return { folders, totalPhotos };
}
