export interface PipelineOp {
  op: string;
  [key: string]: unknown;
}

export interface ParamConfig {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface OpConfig {
  op: string;
  label: string;
  enabled: boolean;
  params: ParamConfig[];
  extras?: Record<string, unknown>;
}

export interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  data_url?: string;
}

export const DEFAULT_OPS: OpConfig[] = [
  {
    op: 'highlights',
    label: 'Света',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0, min: -1, max: 1, step: 0.01 },
    ],
  },
  {
    op: 'shadows',
    label: 'Тени',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0, min: -1, max: 1, step: 0.01 },
    ],
  },
  {
    op: 'skin_fs',
    label: 'Гладкость кожи',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0, min: -1, max: 1, step: 0.01 },
      { key: 'texture_radius', label: 'Радиус текстуры', value: 10.5, min: 1, max: 20, step: 0.5 },
      { key: 'texture_amount', label: 'Текстура', value: 0, min: -1, max: 1, step: 0.01 },
    ],
    extras: { mask: { max_det_side: 2500 } },
  },
  {
    op: 'deshine',
    label: 'Убрать блеск',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0, min: -1, max: 1, step: 0.01 },
      { key: 'knee', label: 'Порог', value: 0, min: -1, max: 1, step: 0.01 },
    ],
    extras: { mask: { max_det_side: 2500 } },
  },
  {
    op: 'blackheads',
    label: 'Чистка лица',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0, min: -1, max: 1, step: 0.01 },
    ],
  },
  {
    op: 'skin_smooth',
    label: 'Сглаживание кожи',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0, min: -1, max: 1, step: 0.01 },
    ],
    extras: { mask: { max_det_side: 2500 } },
  },
  {
    op: 'face_enhance',
    label: 'Улучшение лица',
    enabled: true,
    params: [],
  },
  {
    op: 'sharpen',
    label: 'Резкость',
    enabled: true,
    params: [
      { key: 'strength', label: 'Сила', value: 0, min: -1, max: 1, step: 0.01 },
    ],
  },
];

export const isSymmetricParam = (param: ParamConfig): boolean => {
  return param.min === -1 && param.max === 1;
};

export const serverToUi = (serverVal: number, param: ParamConfig): number => {
  if (!isSymmetricParam(param)) return serverVal;
  return Math.round((serverVal * 2 - 1) * 100) / 100;
};

export const uiToServer = (uiVal: number, param: ParamConfig): number => {
  if (!isSymmetricParam(param)) return uiVal;
  return Math.round(((uiVal + 1) / 2) * 100) / 100;
};

export const opsFromPipeline = (pipeline: PipelineOp[]): OpConfig[] => {
  const result: OpConfig[] = [];
  pipeline.forEach(found => {
    const def = DEFAULT_OPS.find(d => d.op === found.op);
    if (!def) return;
    const extras: Record<string, unknown> = {};
    Object.keys(found).forEach(k => {
      if (k === 'op') return;
      if (def.params.some(p => p.key === k)) return;
      extras[k] = found[k];
    });
    result.push({
      ...def,
      enabled: true,
      params: def.params.map(param => ({
        ...param,
        value: typeof found[param.key] === 'number'
          ? serverToUi(found[param.key] as number, param)
          : param.value,
      })),
      extras: Object.keys(extras).length > 0 ? extras : def.extras,
    });
  });
  DEFAULT_OPS.forEach(def => {
    if (!result.some(r => r.op === def.op)) {
      result.push({ ...def, enabled: false });
    }
  });
  return result;
};

export const opsToJson = (ops: OpConfig[]): PipelineOp[] => {
  return ops
    .filter(o => o.enabled)
    .map(o => {
      const result: PipelineOp = { op: o.op };
      o.params.forEach(p => { result[p.key] = uiToServer(p.value, p); });
      if (o.extras) {
        Object.entries(o.extras).forEach(([k, v]) => { result[k] = v; });
      }
      return result;
    });
};

const getParamValue = (ops: OpConfig[], opName: string, paramKey: string): number => {
  const op = ops.find(o => o.op === opName);
  if (!op || !op.enabled) return 0;
  const param = op.params.find(p => p.key === paramKey);
  return param ? param.value : 0;
};

export const buildPreviewFilter = (ops: OpConfig[]): string => {
  const shadows = getParamValue(ops, 'shadows', 'strength');
  const highlights = getParamValue(ops, 'highlights', 'strength');
  const skinStrength = getParamValue(ops, 'skin_fs', 'strength');
  const deshineStrength = getParamValue(ops, 'deshine', 'strength');
  const skinSmooth = getParamValue(ops, 'skin_smooth', 'strength');
  const sharpen = getParamValue(ops, 'sharpen', 'strength');

  const brightness = 1.0 + shadows * 0.2 - highlights * 0.1;
  const blurVal = Math.max(0, skinStrength * 0.3 + skinSmooth * 0.25 + deshineStrength * 0.08);
  const contrastVal = 1.0 + sharpen * 0.15;

  let filter = `brightness(${brightness.toFixed(3)}) contrast(${contrastVal.toFixed(3)})`;
  if (blurVal > 0.01) filter += ` blur(${blurVal.toFixed(2)}px)`;

  return filter;
};

const isRawFile = (name: string): boolean => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'raf', 'rw2', 'pef', 'srw'].includes(ext);
};

export const getPhotoUrl = (photo: Photo): string => {
  if (photo.thumbnail_s3_url) return photo.thumbnail_s3_url;
  if (photo.data_url) return photo.data_url;
  if (photo.s3_url && !isRawFile(photo.file_name)) return photo.s3_url;
  return '';
};

export const getPhotoPreviewUrl = (photo: Photo): string => {
  if (photo.thumbnail_s3_url) return photo.thumbnail_s3_url;
  if (photo.s3_url && !isRawFile(photo.file_name)) return photo.s3_url;
  if (photo.data_url) return photo.data_url;
  return '';
};