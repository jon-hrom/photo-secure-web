/**
 * Получение геолокации пользователя с приоритетом GPS на мобильных устройствах
 */

interface GeoLocation {
  city: string;
  country: string;
  country_code: string;
  lat?: string;
  lon?: string;
  source: 'gps' | 'ip';
}

/**
 * Определение, является ли устройство мобильным
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Получение GPS координат с разрешения пользователя
 */
const getGPSCoordinates = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
};

/**
 * Reverse geocoding через Nominatim (OpenStreetMap)
 * Бесплатный сервис без API ключа
 */
const reverseGeocode = async (lat: number, lon: number): Promise<GeoLocation> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ru`,
      {
        headers: {
          'User-Agent': 'foto-mix.ru/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    const address = data.address || {};

    // Извлекаем город (город, поселок, деревня)
    const city = address.city || address.town || address.village || address.municipality || '';
    const country = address.country || '';
    const country_code = address.country_code?.toUpperCase() || '';

    console.log('[GPS] Reverse geocode result:', { city, country, country_code, lat, lon });

    return {
      city,
      country,
      country_code,
      lat: lat.toString(),
      lon: lon.toString(),
      source: 'gps'
    };
  } catch (error) {
    console.error('[GPS] Reverse geocoding error:', error);
    throw error;
  }
};

/**
 * Получение геолокации с приоритетом GPS на мобильных
 */
export const getUserGeolocation = async (): Promise<GeoLocation | null> => {
  // На мобильных устройствах пробуем GPS
  if (isMobileDevice()) {
    try {
      console.log('[GPS] Mobile device detected, requesting GPS permission...');
      const position = await getGPSCoordinates();
      const { latitude, longitude } = position.coords;
      
      console.log('[GPS] GPS coordinates:', { latitude, longitude });
      
      // Reverse geocoding для получения названия города
      const location = await reverseGeocode(latitude, longitude);
      
      console.log('[GPS] Location obtained via GPS:', location);
      return location;
    } catch (error) {
      console.warn('[GPS] GPS unavailable, will use IP geolocation:', error);
      // Fallback на IP геолокацию произойдет на backend
      return null;
    }
  }

  // На десктопе возвращаем null — backend определит по IP
  console.log('[GPS] Desktop device, using IP geolocation');
  return null;
};

/**
 * Форматирование геолокации для отправки на backend
 */
export const formatGeolocationForBackend = (location: GeoLocation | null): string | null => {
  if (!location) return null;
  
  return JSON.stringify({
    city: location.city,
    country: location.country,
    country_code: location.country_code,
    lat: location.lat,
    lon: location.lon,
    source: location.source
  });
};
