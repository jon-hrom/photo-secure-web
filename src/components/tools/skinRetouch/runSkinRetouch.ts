import { SKIN_RETOUCH_URL, PresetKey, EyeSharpenKey, dataUrlToBase64 } from '@/components/tools/skinRetouch/utils';

export class NotEnoughEnergyError extends Error {
  needed: number | string;
  balance: number;
  constructor(needed: number | string, balance: number) {
    super(`Не хватает энергии: нужно ${needed} ⚡, на балансе ${balance} ⚡`);
    this.needed = needed;
    this.balance = balance;
  }
}

export interface SkinRetouchResult {
  /** base64 JPEG без префикса data: */
  image: string;
  charged?: number;
  energy_balance?: number;
}

interface RunOptions {
  userId: string | number;
  sourceDataUrl: string;
  preset: PresetKey;
  eyeSharpen?: EyeSharpenKey;
  onStatus?: (text: string) => void;
  isCancelled?: () => boolean;
}

export const friendlyRetouchError = (e: unknown): string => {
  const raw = String((e as Error)?.message || e);
  return /sensitive content/i.test(raw)
    ? 'Сервис ретуши отклонил это фото фильтром безопасности. Энергия возвращена.'
    : raw;
};

/**
 * Полный прогон ретуши кожи (как в «Инструменты → Ретушь фото»):
 * start → опрос status → compose. Возвращает готовый JPEG в base64.
 */
export const runSkinRetouch = async ({
  userId,
  sourceDataUrl,
  preset,
  eyeSharpen = 'normal',
  onStatus,
  isCancelled,
}: RunOptions): Promise<SkinRetouchResult> => {
  const status = (t: string) => onStatus?.(t);
  const imageB64 = dataUrlToBase64(sourceDataUrl);
  const headers = { 'Content-Type': 'application/json', 'X-User-Id': String(userId) };

  status('Отправляем фото на ретушь...');
  const res = await fetch(`${SKIN_RETOUCH_URL}?action=start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: imageB64 }),
  });
  const started = await res.json();
  if (res.status === 402) {
    throw new NotEnoughEnergyError(started?.needed ?? '?', started?.energy_balance ?? 0);
  }
  if (!res.ok || !started?.task_id) throw new Error(started?.error || `HTTP ${res.status}`);

  status('AI выравнивает кожу...');

  let networkFails = 0;
  let gaveUpOnNetwork = false;
  let taskId = started.task_id as string;
  let retried = false;
  let readyUrl = '';
  const startedAt = Date.now();
  const MAX_WAIT_MS = 12 * 60 * 1000;

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    if (isCancelled?.()) break;
    const waited = Date.now() - startedAt;
    await new Promise((r) => setTimeout(r, waited < 60000 ? 4000 : 8000));
    const mins = Math.floor((Date.now() - startedAt) / 60000);
    let sd: Record<string, unknown>;
    try {
      const sr = await fetch(`${SKIN_RETOUCH_URL}?action=status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ task_id: taskId, image: imageB64, preset, retried }),
      });
      sd = await sr.json();
      if (!sr.ok) throw new Error((sd?.error as string) || `HTTP ${sr.status}`);
      networkFails = 0;
    } catch (netErr) {
      networkFails += 1;
      console.warn('retouch poll failed', netErr);
      if (networkFails >= 8) {
        gaveUpOnNetwork = true;
        break;
      }
      status('Связь оборвалась, повторяем запрос...');
      continue;
    }
    if (sd.status === 'processing') {
      if (sd.task_id && sd.task_id !== taskId) {
        taskId = sd.task_id as string;
        retried = true;
        status('Подбираем другую модель...');
      } else {
        status(mins >= 1 ? `AI выравнивает кожу... ждём ${mins} мин` : 'AI выравнивает кожу...');
      }
      continue;
    }
    if (sd.status === 'refunded') {
      throw new Error((sd.error as string) || 'ретушь не удалась, энергия возвращена');
    }
    if (sd.status === 'failed') throw new Error((sd.error as string) || 'не удалось отретушировать');
    readyUrl = String(sd.url || '');
    break;
  }

  if (!readyUrl) {
    // Энергия списана — просим сервер закрыть задачу (вернёт энергию, если результата нет).
    let abandonData: Record<string, unknown> | null = null;
    try {
      const ar = await fetch(`${SKIN_RETOUCH_URL}?action=abandon`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ task_id: taskId }),
      });
      abandonData = await ar.json();
    } catch (e) {
      console.warn('abandon failed', e);
    }
    if (abandonData?.status === 'ready' && abandonData.url) {
      readyUrl = String(abandonData.url);
    } else {
      const cause = isCancelled?.()
        ? 'Остановлено'
        : gaveUpOnNetwork
          ? 'Пропала связь с сервером'
          : 'Сервис ретуши не ответил за 12 минут';
      throw new Error(abandonData?.refunded ? `${cause}. Энергия возвращена.` : `${cause}.`);
    }
  }

  status('Собираем результат...');
  let data: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const cr = await fetch(`${SKIN_RETOUCH_URL}?action=compose`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: readyUrl, image: imageB64, preset, eye_sharpen: eyeSharpen }),
      });
      const cd = await cr.json();
      if (!cr.ok) throw new Error((cd?.error as string) || `HTTP ${cr.status}`);
      if (cd.status === 'failed') throw new Error((cd.error as string) || 'не удалось собрать результат');
      data = cd;
      break;
    } catch (composeErr) {
      if (attempt === 2) throw composeErr;
      console.warn('retouch compose failed, retrying', composeErr);
      status('Повторяем сборку...');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!data?.image) throw new Error('Не удалось собрать результат');

  return {
    image: String(data.image),
    charged: data.charged as number | undefined,
    energy_balance: data.energy_balance as number | undefined,
  };
};
