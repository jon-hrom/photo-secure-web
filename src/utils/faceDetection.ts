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

export const loadFaceDetectionModels = async (): Promise<boolean> => {
  if (modelsLoaded) return true;

  try {
    const MODEL_URL = '/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    return true;
  } catch (error) {
    console.warn('⚠️ Face detection models not found. Face detection will be disabled.');
    return false;
  }
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