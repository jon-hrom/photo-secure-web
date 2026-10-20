import type { BodyGeo, FaceGeo, Pt, VisPt } from './detect';
import type { PlasticParams } from './warp';

/** Человек на фото: лицо, поза (если нашлась) и миниатюра лица для выбора. */
export interface Person {
  id: number;
  face: FaceGeo;
  pose: VisPt[] | null;
  thumb: string;
}

export const ZONE_KEYS = ['jaw', 'chin', 'shoulders', 'arms', 'waist', 'belly', 'hips'] as const;
export type ZoneKey = (typeof ZONE_KEYS)[number];

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const ok = (...pts: (VisPt | undefined)[]) => pts.every((p) => !!p && p.v > 0.5);

const faceTop = (f: FaceGeo) => sub(f.jaw[8], mul(f.down, f.width * 0.55));

/** Связывает лица с позами и режет миниатюры лиц. */
export const buildPeople = (img: HTMLImageElement, geo: BodyGeo): Person[] => {
  const used = new Set<number>();
  return geo.faces.map((face, id) => {
    const c = faceTop(face);
    let pose: VisPt[] | null = null;
    let best = face.width * 1.2;
    geo.poses.forEach((p, i) => {
      if (used.has(i) || !p[0]) return;
      const d = len(sub(p[0], c));
      if (d < best) {
        best = d;
        pose = p;
        used.add(i);
      }
    });
    const size = face.width * 1.6;
    const t = document.createElement('canvas');
    t.width = 96;
    t.height = 96;
    const sx = img.naturalWidth / geo.width;
    const sy = img.naturalHeight / geo.height;
    t.getContext('2d')!.drawImage(img, (c.x - size / 2) * sx, (c.y - size / 2) * sy, size * sx, size * sy, 0, 0, 96, 96);
    return { id, face, pose, thumb: t.toDataURL('image/jpeg', 0.85) };
  });
};

type Ctx = CanvasRenderingContext2D;

const line = (ctx: Ctx, a: Pt, b: Pt, w: number) => {
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
};

const ellipse = (ctx: Ctx, c: Pt, along: number, across: number, dir: Pt) => {
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, Math.max(1, along), Math.max(1, across), Math.atan2(dir.y, dir.x), 0, Math.PI * 2);
  ctx.fill();
};

interface Torso {
  midS: Pt;
  midH: Pt;
  t: Pt;
  n: Pt;
  T: number;
  sw: number;
  hipW: number;
  half: number;
  thigh: number;
}

const torso = (p: VisPt[]): Torso | null => {
  if (!ok(p[11], p[12], p[23], p[24])) return null;
  const midS = lerp(p[11], p[12], 0.5);
  const midH = lerp(p[23], p[24], 0.5);
  const axis = sub(midH, midS);
  const T = len(axis);
  if (T < 20) return null;
  const t = norm(axis);
  const sw = len(sub(p[11], p[12]));
  const hipW = len(sub(p[23], p[24]));
  const thigh = ok(p[25], p[26]) ? (len(sub(p[25], p[23])) + len(sub(p[26], p[24]))) / 2 : T * 0.9;
  return { midS, midH, t, n: { x: -t.y, y: t.x }, T, sw, hipW, half: Math.max(hipW * 0.75, sw * 0.42), thigh };
};

/** Рисует белым одну зону пластики для человека (в координатах детектора). */
const drawZone = (ctx: Ctx, person: Person, zone: ZoneKey) => {
  const f = person.face;
  const W = f.width;
  const side = { x: -f.down.y, y: f.down.x };
  const p = person.pose;
  if (zone === 'jaw') {
    ctx.beginPath();
    f.jaw.slice(2, 15).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.lineWidth = W * 0.14;
    ctx.stroke();
    return;
  }
  if (zone === 'chin') {
    ellipse(ctx, add(f.jaw[8], mul(f.down, W * 0.16)), W * 0.32, W * 0.18, side);
    return;
  }
  if (!p) return;
  const sw = ok(p[11], p[12]) ? len(sub(p[11], p[12])) : 0;
  if (zone === 'shoulders' && sw > 10) {
    const down = torso(p)?.t ?? { x: 0, y: 1 };
    const across = norm(sub(p[11], p[12]));
    for (const s of [p[11], p[12]]) ellipse(ctx, sub(s, mul(down, sw * 0.08)), sw * 0.17, sw * 0.11, across);
    return;
  }
  if (zone === 'arms' && sw > 10) {
    for (const [s, e, w] of [[11, 13, 15], [12, 14, 16]]) {
      if (ok(p[s], p[e])) line(ctx, p[s], p[e], sw * 0.42);
      if (ok(p[e], p[w])) line(ctx, p[e], p[w], sw * 0.28);
    }
    return;
  }
  const tr = torso(p);
  if (!tr) return;
  if (zone === 'waist') {
    const c = lerp(tr.midS, tr.midH, 0.68);
    for (const k of [-1, 1]) ellipse(ctx, add(c, mul(tr.n, tr.half * k)), tr.T * 0.3, tr.half * 0.35, tr.t);
    return;
  }
  if (zone === 'belly') {
    ellipse(ctx, lerp(tr.midS, tr.midH, 0.82), tr.T * 0.24, tr.half * 0.8, tr.t);
    return;
  }
  if (zone === 'hips') {
    for (const h of [p[23], p[24]]) {
      const out = norm(sub(h, tr.midH));
      const c = add(add(h, mul(out, tr.hipW * 0.3)), mul(tr.t, tr.thigh * 0.15));
      ellipse(ctx, c, tr.thigh * 0.42, tr.hipW * 0.45, tr.t);
    }
  }
};

const scaledCtx = (w: number, h: number, geo: BodyGeo) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.setTransform(w / geo.width, 0, 0, h / geo.height, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return { c, ctx };
};

export const activeZones = (params: PlasticParams) =>
  ZONE_KEYS.filter((k) => params[k] > 0).map((k) => ({ zone: k, amount: params[k] }));

/** Маска зон пластики одного человека в разрешении фото. */
export const zoneMask = (w: number, h: number, geo: BodyGeo, person: Person, params: PlasticParams) => {
  const { c, ctx } = scaledCtx(w, h, geo);
  for (const { zone } of activeZones(params)) drawZone(ctx, person, zone);
  return c;
};

/** Силуэт человека — чтобы вернуть ему оригинальные пиксели. */
const silhouette = (w: number, h: number, geo: BodyGeo, people: Person[]) => {
  const { c, ctx } = scaledCtx(w, h, geo);
  for (const person of people) {
    const f = person.face;
    const W = f.width;
    ellipse(ctx, faceTop(f), W * 1.15, W * 0.9, f.down);
    line(ctx, f.jaw[8], add(f.jaw[8], mul(f.down, W * 0.7)), W * 0.85);
    const p = person.pose;
    if (!p) {
      ellipse(ctx, add(f.jaw[8], mul(f.down, W * 1.6)), W * 1.5, W * 1.4, f.down);
      continue;
    }
    const sw = ok(p[11], p[12]) ? len(sub(p[11], p[12])) : W * 1.5;
    if (ok(p[11], p[12])) line(ctx, f.jaw[8], lerp(p[11], p[12], 0.5), W * 0.9);
    const segs = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28]];
    for (const [a, b] of segs) if (ok(p[a], p[b])) line(ctx, p[a], p[b], sw * 0.5);
    if (ok(p[11], p[12], p[23], p[24])) {
      ctx.beginPath();
      [p[11], p[12], p[24], p[23]].forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.fill();
    }
  }
  return c;
};

const loadImg = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

/** Возвращает людям, которых сняли с обработки, их исходные пиксели. */
export const restoreExcluded = async (resultUrl: string, originalUrl: string, geo: BodyGeo, excluded: Person[]) => {
  if (!excluded.length) return resultUrl;
  const [res, orig] = await Promise.all([loadImg(resultUrl), loadImg(originalUrl)]);
  const w = res.naturalWidth;
  const h = res.naturalHeight;
  const sil = silhouette(w, h, geo, excluded);
  const soft = document.createElement('canvas');
  soft.width = w;
  soft.height = h;
  const sctx = soft.getContext('2d')!;
  const blur = Math.max(2, Math.round(Math.min(...excluded.map((p) => p.face.width)) * (w / geo.width) * 0.08));
  sctx.filter = `blur(${blur}px)`;
  sctx.drawImage(sil, 0, 0);
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d')!;
  tctx.drawImage(orig, 0, 0, w, h);
  tctx.globalCompositeOperation = 'destination-in';
  tctx.drawImage(soft, 0, 0);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  octx.drawImage(res, 0, 0);
  octx.drawImage(tmp, 0, 0);
  return out.toDataURL('image/jpeg', 0.95);
};

/** Превью: где AI будет работать — розовые зоны поверх фото. */
export const zonesPreview = (img: HTMLImageElement, geo: BodyGeo, people: Person[], params: PlasticParams) => {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  octx.drawImage(img, 0, 0);
  const { c, ctx } = scaledCtx(w, h, geo);
  for (const person of people) for (const { zone } of activeZones(params)) drawZone(ctx, person, zone);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = 'rgba(236, 72, 153, 0.38)';
  ctx.fillRect(0, 0, w, h);
  octx.drawImage(c, 0, 0);
  return out.toDataURL('image/jpeg', 0.9);
};
