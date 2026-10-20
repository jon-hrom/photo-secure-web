import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoWithFaces {
  photoId: string;
  url: string;
  width: number;
  height: number;
  faces: FaceBox[];
}

let lastLoadError = '';
let loadingPromise: Promise<boolean> | null = null;

/** Причина последнего сбоя загрузки — для понятного сообщения пользователю. */
export const getFaceModelsError = () => lastLoadError;

type Tf = {
  ready: () => Promise<void>;
  getBackend: () => string | undefined;
  setBackend: (name: string) => Promise<boolean>;
};

const loadNets = async () => {
  const MODEL_URL = `${window.location.origin}/models`;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  ]);
  // Пробный прогон: на некоторых видеокартах WebGL «есть», но падает при первом расчёте
  const probe = document.createElement('canvas');
  probe.width = 64;
  probe.height = 64;
  await faceapi.detectAllFaces(probe, new faceapi.TinyFaceDetectorOptions({ inputSize: 128 }));
};

const doLoad = async (): Promise<boolean> => {
  const tf = faceapi.tf as unknown as Tf;
  // Попытка 1 — бэкенд по умолчанию (WebGL — быстро). Попытка 2 — процессор (надёжно везде).
  for (const backend of [null, 'cpu'] as const) {
    try {
      if (backend) {
        await tf.setBackend(backend);
      }
      try {
        await tf.ready();
        if (!tf.getBackend()) throw new Error('no backend');
      } catch {
        await tf.setBackend('cpu');
        await tf.ready();
      }
      await loadNets();
      console.log('[FACE_MODELS] loaded on backend', tf.getBackend());
      lastLoadError = '';
      return true;
    } catch (error) {
      lastLoadError = String((error as Error)?.message || error).slice(0, 200);
      console.warn('[FACE_MODELS] load failed on', backend || tf.getBackend?.() || 'default', error);
    }
  }
  return false;
};

export const loadFaceDetectionModels = async (): Promise<boolean> => {
  if (modelsLoaded) return true;
  if (!loadingPromise) {
    loadingPromise = doLoad().then((ok) => {
      modelsLoaded = ok;
      loadingPromise = null;
      return ok;
    });
  }
  return loadingPromise;
};

export const detectFacesInImage = async (
  imageUrl: string
): Promise<FaceBox[]> => {
  if (!modelsLoaded) {
    const loaded = await loadFaceDetectionModels();
    if (!loaded) return [];
  }

  try {
    const img = await loadImage(imageUrl);
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks();

    return detections.map((detection) => {
      const box = detection.detection.box;
      return {
        x: box.x / img.width,
        y: box.y / img.height,
        width: box.width / img.width,
        height: box.height / img.height,
      };
    });
  } catch (error) {
    console.error('Face detection failed for image:', error);
    return [];
  }
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

export const detectFacesInPhotos = async (
  photos: Array<{ id: string; url: string; width: number; height: number }>
): Promise<PhotoWithFaces[]> => {
  const loaded = await loadFaceDetectionModels();
  
  if (!loaded) {
    return photos.map(photo => ({
      photoId: photo.id,
      url: photo.url,
      width: photo.width,
      height: photo.height,
      faces: [],
    }));
  }

  const results: PhotoWithFaces[] = [];

  for (const photo of photos) {
    const faces = await detectFacesInImage(photo.url);
    results.push({
      photoId: photo.id,
      url: photo.url,
      width: photo.width,
      height: photo.height,
      faces,
    });
  }

  return results;
};