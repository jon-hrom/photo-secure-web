/**
 * Защита глаз: AI при перерисовке может свести зрачки (косоглазие) или сузить веки.
 * Находим глаза на ОРИГИНАЛЕ и в этих местах оставляем геометрию оригинала.
 */
import * as faceapi from '@vladmandic/face-api';
import { loadFaceDetectionModels } from '@/utils/faceDetection';

/** Эллипс зоны глаза в долях от размера кадра (0..1). */
export interface EyeZone {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const DETECT_SIDE = 1600;

export const detectEyeZones = async (img: HTMLImageElement): Promise<EyeZone[]> => {
  try {
    if (!(await loadFaceDetectionModels())) return [];
    const k = Math.min(1, DETECT_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const res = await faceapi
      .detectAllFaces(c, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.3 }))
      .withFaceLandmarks();
    const W = c.width;
    const H = c.height;
    c.width = 0;
    const zones: EyeZone[] = [];
    for (const r of res) {
      const p = r.landmarks.positions;
      for (const [a, b] of [[36, 41], [42, 47]]) {
        const pts = p.slice(a, b + 1);
        const xs = pts.map((q) => q.x);
        const ys = pts.map((q) => q.y);
        const x0 = Math.min(...xs);
        const x1 = Math.max(...xs);
        const y0 = Math.min(...ys);
        const y1 = Math.max(...ys);
        const ew = x1 - x0;
        // с запасом: веки, ресницы, уголки глаз
        const rx = ew * 0.85;
        const ry = Math.max(y1 - y0, ew * 0.35) * 1.6;
        zones.push({ cx: (x0 + x1) / 2 / W, cy: (y0 + y1) / 2 / H, rx: rx / W, ry: ry / H });
      }
    }
    return zones;
  } catch (e) {
    console.warn('[UPSCALE] eye detection failed', e);
    return [];
  }
};

/** Вес «брать оригинал» (0..1) для строк [oy0, oy1) итога размером outW×outH. */
export const eyeWeights = (zones: EyeZone[], outW: number, outH: number, oy0: number, oy1: number) => {
  if (!zones.length) return null;
  const rows = oy1 - oy0;
  const w = new Float32Array(outW * rows);
  let any = false;
  for (const z of zones) {
    const cx = z.cx * outW;
    const cy = z.cy * outH;
    const rx = z.rx * outW;
    const ry = z.ry * outH;
    const yA = Math.max(oy0, Math.floor(cy - ry));
    const yB = Math.min(oy1, Math.ceil(cy + ry));
    if (yA >= yB) continue;
    const xA = Math.max(0, Math.floor(cx - rx));
    const xB = Math.min(outW, Math.ceil(cx + rx));
    for (let y = yA; y < yB; y++) {
      const dy = (y + 0.5 - cy) / ry;
      const o = (y - oy0) * outW;
      for (let x = xA; x < xB; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1) continue;
        // плотное ядро, мягкий край
        const v = d <= 0.6 ? 1 : 1 - (d - 0.6) / 0.4;
        const s = v * v * (3 - 2 * v);
        if (s > w[o + x]) w[o + x] = s;
        any = true;
      }
    }
  }
  return any ? w : null;
};
