/**
 * Перенос глаз: открытые глаза с фото-донора вклеиваются настоящими пикселями на место
 * (например, закрытых) глаз на целевом фото. Каждый глаз ставится отдельно по своим
 * уголкам — так учитываются поворот головы (у повёрнутого лица глаза разной ширины),
 * наклон и размер. Высота глаза берётся у донора (он открыт) и масштабируется вместе
 * с шириной; дополнительно поправляется наклон головы вверх/вниз (вертикальное сжатие).
 * Свет и тон кожи берутся с целевого фото (низкие частоты), а резкие детали глаза — с донора.
 */
import { loadFaceDetectionModels, getFaceModelsError } from '@/utils/faceDetection';
import { P, loadImg, toCanvas, binarize, maskBox, landmarksNear } from '@/components/tools/faceSwap/exactHead';

const LEFT = [36, 37, 38, 39, 40, 41];
const RIGHT = [42, 43, 44, 45, 46, 47];

const mean = (pts: P[]) => ({
  x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
  y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
});
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** Отношение «глаза → рот» к расстоянию между глазами: падает, когда голова наклонена вверх/вниз. */
const pitchRatio = (l: P[]) => {
  const eyes = mean([...LEFT, ...RIGHT].map((i) => l[i]));
  const mouth = mean([48, 54, 51, 57].map((i) => l[i]));
  const io = dist(mean(LEFT.map((i) => l[i])), mean(RIGHT.map((i) => l[i]))) || 1;
  return dist(eyes, mouth) / io;
};

type M6 = [number, number, number, number, number, number];

/** Матрица донор → цель для одного глаза: уголки совпадают, по высоте — коэффициент kv. */
const eyeMatrix = (d0: P, d1: P, t0: P, t1: P, kv: number): M6 => {
  const dv = { x: d1.x - d0.x, y: d1.y - d0.y };
  const tv = { x: t1.x - t0.x, y: t1.y - t0.y };
  const dl = Math.hypot(dv.x, dv.y) || 1;
  const tl = Math.hypot(tv.x, tv.y) || 1;
  const s = tl / dl;
  const ad = Math.atan2(dv.y, dv.x);
  const at = Math.atan2(tv.y, tv.x);
  // донор: перенос в начало, поворот на -ad (ось глаза → X), масштаб (s, s·kv), поворот на at, перенос в t0
  const ca = Math.cos(-ad), sa = Math.sin(-ad);
  const cb = Math.cos(at), sb = Math.sin(at);
  // A = Rb · diag(s, s·kv) · Ra
  const sx = s, sy = s * kv;
  const a11 = cb * sx * ca - sb * sy * sa;
  const a12 = -cb * sx * sa - sb * sy * ca;
  const a21 = sb * sx * ca + cb * sy * sa;
  const a22 = -sb * sx * sa + cb * sy * ca;
  const e = t0.x - (a11 * d0.x + a12 * d0.y);
  const f = t0.y - (a21 * d0.x + a22 * d0.y);
  return [a11, a21, a12, a22, e, f];
};

export interface EyeSwapInput {
  donorUrl: string;
  donorMask: HTMLCanvasElement;
  targetUrl: string;
  targetMask: HTMLCanvasElement;
}

export type EyeSwapResult = { ok: true; dataUrl: string } | { ok: false; reason: string };

export const eyeSwap = async ({ donorUrl, donorMask, targetUrl, targetMask }: EyeSwapInput): Promise<EyeSwapResult> => {
  if (!(await loadFaceDetectionModels())) {
    const why = getFaceModelsError();
    return {
      ok: false,
      reason: `Не загрузился модуль распознавания лиц. Обновите страницу (Ctrl+F5) и попробуйте снова.${why ? ` Причина: ${why}` : ''}`,
    };
  }
  const [dImg, tImg] = await Promise.all([loadImg(donorUrl), loadImg(targetUrl)]);
  const DW = dImg.naturalWidth, DH = dImg.naturalHeight;
  const TW = tImg.naturalWidth, TH = tImg.naturalHeight;
  const donor = toCanvas(dImg, DW, DH);
  const target = toCanvas(tImg, TW, TH);
  const dBox = maskBox(binarize(toCanvas(donorMask, DW, DH)));
  const tBox = maskBox(binarize(toCanvas(targetMask, TW, TH)));
  if (!dBox || !tBox) return { ok: false, reason: 'Отметьте кистью лицо на обоих фото.' };
  const grow = (b: NonNullable<typeof dBox>, W: number, H: number) => {
    const m = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.5;
    return { x0: Math.max(0, b.x0 - m), y0: Math.max(0, b.y0 - m), x1: Math.min(W, b.x1 + m), y1: Math.min(H, b.y1 + m) };
  };
  const [dl, tl] = await Promise.all([landmarksNear(donor, grow(dBox, DW, DH)), landmarksNear(target, grow(tBox, TW, TH))]);
  if (!dl) return { ok: false, reason: 'Не нашли лицо на фото-доноре. Нужен снимок, где лицо видно целиком.' };
  if (!tl) return { ok: false, reason: 'Не нашли лицо на фото, куда вставляем. Отметьте лицо целиком.' };

  // Наклон вверх/вниз: если на целевом фото лицо «короче» по вертикали — глаза чуть ниже по высоте
  const kv = Math.min(1.15, Math.max(0.85, pitchRatio(tl) / pitchRatio(dl)));

  const out = toCanvas(target, TW, TH);
  const O = out.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, TW, TH);
  const od = O.data;

  for (const [idx, c0, c1] of [[LEFT, 36, 39], [RIGHT, 42, 45]] as const) {
    const t0 = tl[c0], t1 = tl[c1];
    const w = dist(t0, t1);
    if (w < 4) continue;
    const M = eyeMatrix(dl[c0], dl[c1], t0, t1, kv);
    const ang = Math.atan2(t1.y - t0.y, t1.x - t0.x);
    const c = mean([t0, t1]);
    // Область: от складки века до верха щеки, по ширине — с запасом за уголки
    const nx = Math.sin(ang), ny = -Math.cos(ang);
    const cx = c.x + nx * w * 0.08, cy = c.y + ny * w * 0.08;
    const rx = w * 0.95;

    const pad = Math.ceil(rx + 4);
    const bx0 = Math.max(0, Math.floor(cx - pad)), by0 = Math.max(0, Math.floor(cy - pad));
    const bx1 = Math.min(TW, Math.ceil(cx + pad)), by1 = Math.min(TH, Math.ceil(cy + pad));
    const bw = bx1 - bx0, bh = by1 - by0;
    if (bw < 4 || bh < 4) continue;

    const warped = document.createElement('canvas');
    warped.width = bw;
    warped.height = bh;
    const wc = warped.getContext('2d', { willReadFrequently: true })!;
    wc.imageSmoothingEnabled = true;
    wc.imageSmoothingQuality = 'high';
    wc.setTransform(M[0], M[1], M[2], M[3], M[4] - bx0, M[5] - by0);
    wc.drawImage(donor, 0, 0);
    const Wd = wc.getImageData(0, 0, bw, bh).data;

    // Маска по форме глаза цели: веко сверху с запасом, снизу — тонкая полоса.
    // Кожу под глазом (мешки, тени) оставляем свою — именно там появлялись следы.
    const tc = mean(idx.map((i) => tl[i]));
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const toLocal = (p: P) => ({ u: (p.x - tc.x) * ux + (p.y - tc.y) * uy, v: -(p.x - tc.x) * uy + (p.y - tc.y) * ux });
    const toWorld = (u: number, v: number) => ({ x: tc.x + u * ux - v * uy - bx0, y: tc.y + u * uy + v * ux - by0 });
    const contour = idx.map((i) => toLocal(tl[i]));
    const drawShape = (ctx: CanvasRenderingContext2D, grow: number, up: number, down: number) => {
      ctx.beginPath();
      contour.forEach((q, j) => {
        const u = q.u * grow;
        const v = q.v < 0 ? q.v * grow - up : q.v * grow + down;
        const pt = toWorld(u, v);
        if (j === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fill();
    };
    const mk = document.createElement('canvas');
    mk.width = bw;
    mk.height = bh;
    const mc = mk.getContext('2d', { willReadFrequently: true })!;
    mc.filter = `blur(${Math.max(1.2, w * 0.1)}px)`;
    mc.fillStyle = '#fff';
    drawShape(mc, 1.25, w * 0.22, w * 0.05);
    const Md = mc.getImageData(0, 0, bw, bh).data;

    // Сам глаз (без кожи) — чтобы мерить цвет кожи только вокруг него
    const ek = document.createElement('canvas');
    ek.width = bw;
    ek.height = bh;
    const ec = ek.getContext('2d', { willReadFrequently: true })!;
    ec.fillStyle = '#fff';
    drawShape(ec, 1.08, w * 0.04, w * 0.03);
    const Ed = ec.getImageData(0, 0, bw, bh).data;

    // Цвет кожи: отдельно для верхнего века и для полосы под глазом, плавный переход между ними
    const acc = { up: [0, 0, 0, 0, 0, 0, 0], dn: [0, 0, 0, 0, 0, 0, 0] };
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = (y * bw + x) * 4;
        const m = Md[i + 3] / 255;
        if (m < 0.2 || Ed[i + 3] > 10 || Wd[i + 3] < 250) continue;
        const v = -(x + bx0 - tc.x) * uy + (y + by0 - tc.y) * ux;
        const r = v < 0 ? acc.up : acc.dn;
        const g = ((by0 + y) * TW + bx0 + x) * 4;
        for (let k = 0; k < 3; k++) { r[k] += od[g + k]; r[k + 3] += Wd[i + k]; }
        r[6]++;
      }
    }
    const gainOf = (r: number[]) => [0, 1, 2].map((k) => (r[6] > 8 ? Math.min(1.6, Math.max(0.6, (r[k] + 1) / (r[k + 3] + 1))) : 1));
    const gUp = gainOf(acc.up[6] > 8 ? acc.up : acc.dn);
    const gDn = gainOf(acc.dn[6] > 8 ? acc.dn : acc.up);

    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = (y * bw + x) * 4;
        const m = Md[i + 3] / 255;
        const a = m * m * (3 - 2 * m) * (Wd[i + 3] / 255);
        if (a < 0.004) continue;
        const v = -(x + bx0 - tc.x) * uy + (y + by0 - tc.y) * ux;
        const t = Math.min(1, Math.max(0, v / (w * 0.3) + 0.5));
        const g = ((by0 + y) * TW + bx0 + x) * 4;
        for (let k = 0; k < 3; k++) {
          const gain = gUp[k] * (1 - t) + gDn[k] * t;
          const val = Math.min(255, Wd[i + k] * gain);
          od[g + k] = od[g + k] * (1 - a) + val * a;
        }
      }
    }
    ek.width = 0;
    warped.width = 0;
    mk.width = 0;
    console.log('[EYE_SWAP] eye', idx === LEFT ? 'L' : 'R', 'width', w.toFixed(1));
  }
  console.log('[EYE_SWAP] pitch k', kv.toFixed(3));

  out.getContext('2d')!.putImageData(O, 0, 0);
  const dataUrl = out.toDataURL('image/jpeg', 0.95);
  out.width = 0;
  donor.width = 0;
  target.width = 0;
  return { ok: true, dataUrl };
};
