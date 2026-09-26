import * as faceapi from '@vladmandic/face-api';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { loadFaceDetectionModels } from '@/utils/faceDetection';

export interface Pt {
  x: number;
  y: number;
}

export interface VisPt extends Pt {
  v: number;
}

/** Лицо: контур челюсти (17 точек, слева направо) и направление «вниз» по лицу. */
export interface FaceGeo {
  jaw: Pt[];
  /** Ширина лица по челюсти, px */
  width: number;
  /** Единичный вектор «вниз» по лицу (от глаз к подбородку) */
  down: Pt;
}

export interface BodyGeo {
  width: number;
  height: number;
  faces: FaceGeo[];
  /** Позы: 33 точки MediaPipe в пикселях */
  poses: VisPt[][];
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

let posePromise: Promise<PoseLandmarker | null> | null = null;

/** MediaPipe Pose грузится один раз и живёт до перезагрузки страницы. */
const getPose = () => {
  if (!posePromise) {
    posePromise = (async () => {
      try {
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        return await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task', delegate: 'CPU' },
          runningMode: 'IMAGE',
          numPoses: 6,
          minPoseDetectionConfidence: 0.4,
          minPosePresenceConfidence: 0.4,
        });
      } catch (e) {
        console.warn('[PLASTIC] pose model failed', e);
        posePromise = null;
        return null;
      }
    })();
  }
  return posePromise;
};

const detectFaces = async (canvas: HTMLCanvasElement): Promise<FaceGeo[]> => {
  const ok = await loadFaceDetectionModels();
  if (!ok) return [];
  try {
    // Крупный вход детектора — чтобы находить лица и на общих планах.
    const res = await faceapi
      .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.3 }))
      .withFaceLandmarks();
    return res.map((r) => {
      const pts = r.landmarks.positions.map((p) => ({ x: p.x, y: p.y }));
      const jaw = pts.slice(0, 17);
      const eyes = mid(pts[39], pts[42]);
      return { jaw, width: len(sub(jaw[16], jaw[0])), down: norm(sub(jaw[8], eyes)) };
    });
  } catch (e) {
    console.warn('[PLASTIC] face detect failed', e);
    return [];
  }
};

const detectPoses = async (canvas: HTMLCanvasElement): Promise<VisPt[][]> => {
  const pose = await getPose();
  if (!pose) return [];
  try {
    const res = pose.detect(canvas);
    return (res.landmarks || []).map((lm) =>
      lm.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height, v: p.visibility ?? 1 })),
    );
  } catch (e) {
    console.warn('[PLASTIC] pose detect failed', e);
    return [];
  }
};

/** Лицо по позе — когда лицо слишком мелкое для детектора лиц (общий план). */
const faceFromPose = (p: VisPt[]): FaceGeo | null => {
  const eyeL = p[2];
  const eyeR = p[5];
  const mouthL = p[9];
  const mouthR = p[10];
  if (!eyeL || !mouthL || Math.min(eyeL.v, eyeR.v, mouthL.v, mouthR.v) < 0.5) return null;
  const eyes = mid(eyeL, eyeR);
  const mouth = mid(mouthL, mouthR);
  const scale = len(sub(mouth, eyes));
  if (scale < 4) return null;
  const down = norm(sub(mouth, eyes));
  const side = { x: -down.y, y: down.x };
  const earsOk = p[7].v > 0.4 && p[8].v > 0.4;
  const halfW = earsOk ? (len(sub(p[7], p[8])) / 2) * 0.9 : scale * 1.35;
  const b = scale * 1.25;
  const chin = add(mouth, mul(down, scale * 0.75));
  const center = sub(chin, mul(down, b));
  const jaw: Pt[] = [];
  for (let i = 0; i < 17; i++) {
    const th = (-0.45 + (0.9 * i) / 16) * Math.PI;
    jaw.push(add(center, add(mul(side, halfW * Math.sin(th)), mul(down, b * Math.cos(th)))));
  }
  // В кадре side может смотреть «влево» — челюсть должна идти слева направо.
  if (jaw[0].x > jaw[16].x) jaw.reverse();
  return { jaw, width: halfW * 2, down };
};

const faceCenter = (f: FaceGeo) => f.jaw[8];

export const detectBody = async (img: HTMLImageElement | HTMLCanvasElement): Promise<BodyGeo> => {
  const canvas = document.createElement('canvas');
  canvas.width = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  canvas.height = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);

  const [faces, poses] = await Promise.all([detectFaces(canvas), detectPoses(canvas)]);

  // Дополняем мелкие лица, которые нашла только поза.
  for (const p of poses) {
    const f = faceFromPose(p);
    if (!f) continue;
    const c = faceCenter(f);
    const dup = faces.some((g) => len(sub(faceCenter(g), c)) < Math.max(g.width, f.width) * 0.6);
    if (!dup) faces.push(f);
  }

  return { width: canvas.width, height: canvas.height, faces, poses };
};
