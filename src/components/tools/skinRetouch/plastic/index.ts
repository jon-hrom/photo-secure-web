import { useCallback, useEffect, useRef, useState } from 'react';
import { detectBody, BodyGeo } from './detect';
import { applyPlastic, isPlasticZero, hasSlimMask, PlasticParams, PLASTIC_ZERO, SlimMask } from './warp';

export type { PlasticParams, SlimMask } from './warp';
export { PLASTIC_ZERO, isPlasticZero, hasSlimMask, maskHasPaint } from './warp';

const STORAGE_KEY = 'retouch_plastic_v1';

const loadImg = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

/** Настройки пластики живут между сессиями: у фотографа обычно одни и те же. */
export const usePlasticParams = (chinDefault = false) => {
  const [params, setParamsState] = useState<PlasticParams>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') return { ...PLASTIC_ZERO, ...saved };
    } catch {
      /* ignore */
    }
    return { ...PLASTIC_ZERO, chin: chinDefault ? 50 : 0 };
  });
  const setParams = useCallback((p: PlasticParams) => {
    setParamsState(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);
  return { params, setParams };
};

const geoCache = new Map<string, Promise<BodyGeo>>();

const geoFor = (url: string, img: HTMLImageElement) => {
  let g = geoCache.get(url);
  if (!g) {
    g = detectBody(img);
    geoCache.set(url, g);
    if (geoCache.size > 6) geoCache.delete(geoCache.keys().next().value as string);
  }
  return g;
};

/**
 * Зона подбородка по точкам лица — прямо в браузере, без запроса к AI.
 * Раньше зону искала серверная модель с таймаутом 4 с и часто не успевала:
 * тогда подбородок молча не обрабатывался.
 */
export const localChinBoxes = async (dataUrl: string): Promise<number[][]> => {
  try {
    const img = await loadImg(dataUrl);
    const geo = await geoFor(dataUrl, img);
    return geo.faces.map((f) => {
      const xs = f.jaw.map((p) => p.x);
      const c = f.jaw[8];
      const W = f.width;
      const x0 = Math.min(...xs) - W * 0.08;
      const x1 = Math.max(...xs) + W * 0.08;
      const y0 = c.y - W * 0.28;
      const y1 = c.y + W * 0.55;
      return [
        Math.max(0, x0 / geo.width),
        Math.max(0, y0 / geo.height),
        Math.min(1, x1 / geo.width),
        Math.min(1, y1 / geo.height),
      ];
    });
  } catch (e) {
    console.warn('[PLASTIC] local chin boxes failed', e);
    return [];
  }
};

/** Применяет пластику к картинке (data URL) и возвращает новый JPEG data URL. */
export const plasticProcess = async (dataUrl: string, params: PlasticParams, slim?: SlimMask | null): Promise<string> => {
  const useSlim = hasSlimMask(slim);
  if (isPlasticZero(params) && !useSlim) return dataUrl;
  const img = await loadImg(dataUrl);
  const geo = isPlasticZero(params) ? null : await geoFor(dataUrl, img);
  if (!useSlim && geo && !geo.faces.length && !geo.poses.length) return dataUrl;
  return applyPlastic(img, geo, params, slim).toDataURL('image/jpeg', 0.95);
};

/**
 * Живое применение пластики к готовому результату ретуши.
 * Бесплатно и мгновенно: считается в браузере, сервер не трогаем.
 */
export const useLivePlastic = (
  baseUrl: string,
  params: PlasticParams,
  onResult: (url: string) => void,
  slim?: SlimMask | null,
  /** Меняется при каждом изменении маски — триггер пересчёта */
  slimVersion = 0,
) => {
  const [status, setStatus] = useState<'idle' | 'detecting' | 'applying' | 'ready'>('idle');
  const [found, setFound] = useState<{ faces: number; bodies: number } | null>(null);
  const imgRef = useRef<{ url: string; img: HTMLImageElement; geo: BodyGeo } | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const runId = useRef(0);

  useEffect(() => {
    if (!baseUrl) {
      imgRef.current = null;
      setFound(null);
      setStatus('idle');
      return;
    }
    const id = ++runId.current;
    const t = setTimeout(async () => {
      try {
        const useSlim = hasSlimMask(slim);
        if (isPlasticZero(params) && !useSlim) {
          onResultRef.current(baseUrl);
          setStatus('ready');
          return;
        }
        let cur = imgRef.current;
        if (!cur || cur.url !== baseUrl) {
          setStatus('detecting');
          const img = await loadImg(baseUrl);
          const geo = await geoFor(baseUrl, img);
          if (id !== runId.current) return;
          cur = { url: baseUrl, img, geo };
          imgRef.current = cur;
          setFound({ faces: geo.faces.length, bodies: geo.poses.length });
        }
        setStatus('applying');
        // Даём браузеру отрисовать статус перед тяжёлым расчётом.
        await new Promise((r) => setTimeout(r, 16));
        if (id !== runId.current) return;
        const url = applyPlastic(cur.img, cur.geo, params, slim).toDataURL('image/jpeg', 0.95);
        if (id !== runId.current) return;
        onResultRef.current(url);
        setStatus('ready');
      } catch (e) {
        console.error('[PLASTIC] apply failed', e);
        setStatus('ready');
      }
    }, 220);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, params, slimVersion]);

  return { status, found };
};