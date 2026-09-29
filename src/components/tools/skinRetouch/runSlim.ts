import { SKIN_RETOUCH_URL } from '@/components/tools/skinRetouch/utils';

/** Маска кисти → PNG base64 в разрешении фото (белое там, где закрашено). */
export const maskToB64 = (mask: HTMLCanvasElement, w: number, h: number): string => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(mask, 0, 0, w, h);
  return c.toDataURL('image/png').split(',')[1] || '';
};

interface SlimOptions {
  userId: string | number;
  imageB64: string;
  maskB64: string;
  onStatus?: (t: string) => void;
  /** slim — сузить объём, redraw — перерисовать зону ровной тканью */
  mode?: 'slim' | 'redraw';
  /** Степень сужения 0–100 — передаётся модели словами */
  amount?: number;
}

/**
 * Генеративная пластика по маске на сервере:
 * slim_start → опрос slim_status → slim_compose. Возвращает JPEG base64.
 */
export const runSlim = async ({ userId, imageB64, maskB64, onStatus, mode = 'slim', amount = 0 }: SlimOptions) => {
  const headers = { 'Content-Type': 'application/json', 'X-User-Id': String(userId) };
  const post = async (action: string, body: object) => {
    const r = await fetch(`${SKIN_RETOUCH_URL}?action=${action}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { r, d };
  };

  onStatus?.(mode === 'redraw' ? 'AI перерисовывает складку ровной тканью...' : 'AI перерисовывает руку по маске...');
  const { r, d: started } = await post('slim_start', { image: imageB64, mask: maskB64, mode, amount });
  if (r.status === 402) {
    throw new Error(`Не хватает энергии на пластику: нужно ${started?.needed ?? '?'} ⚡, на балансе ${started?.energy_balance ?? 0} ⚡`);
  }
  if (!r.ok || !started?.task_id) throw new Error(started?.error || `HTTP ${r.status}`);

  let taskId = started.task_id as string;
  let model = started.model as string;
  let url = '';
  let fails = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 8 * 60 * 1000) {
    await new Promise((res) => setTimeout(res, 4000));
    try {
      const { r: sr, d: sd } = await post('slim_status', { task_id: taskId, model, image: imageB64, mask: maskB64, mode, amount });
      if (!sr.ok) throw new Error(sd?.error || `HTTP ${sr.status}`);
      fails = 0;
      if (sd.status === 'processing') {
        if (sd.task_id) {
          taskId = sd.task_id;
          model = sd.model;
          onStatus?.('Пробуем другую модель...');
        }
        continue;
      }
      if (sd.status === 'failed') throw Object.assign(new Error(sd.error || 'пластика не удалась, энергия возвращена'), { final: true });
      url = sd.url;
      break;
    } catch (e) {
      if ((e as { final?: boolean }).final) throw e;
      if (++fails >= 6) throw e;
      onStatus?.('Связь оборвалась, повторяем...');
    }
  }
  if (!url) throw new Error('Сервис не ответил за 8 минут');

  onStatus?.('Вклеиваем результат...');
  for (let i = 0; i < 3; i++) {
    const { r: cr, d: cd } = await post('slim_compose', { image: imageB64, mask: maskB64, url, task_id: taskId });
    if (cr.ok && cd.status === 'done' && cd.image) {
      return { image: String(cd.image), charged: cd.charged as number, energy_balance: cd.energy_balance as number };
    }
    if (cd?.status === 'failed') throw new Error(cd.error || 'ошибка сборки');
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error('Не удалось собрать результат пластики');
};
