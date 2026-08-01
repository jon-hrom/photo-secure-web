import type { ParsedBooking } from './parseBooking';
import func2url from '../../../backend/func2url.json';

const CLIENTS_API = (func2url as Record<string, string>)['clients'];

export interface CreateBookingResult {
  ok: boolean;
  error?: string;
  clientId?: number;
  bookingCreated?: boolean;
}

/**
 * Создаёт заявку на съёмку: заводит нового клиента, а при наличии желаемой даты —
 * добавляет бронь/встречу, которая появится в дашборде фотографа.
 * Тип съёмки и голосовой комментарий сохраняются в описании встречи.
 */
export async function createBooking(data: ParsedBooking): Promise<CreateBookingResult> {
  const userId = localStorage.getItem('userId');
  if (!userId) return { ok: false, error: 'Нет авторизации' };
  if (!data.name && !data.phone) {
    return { ok: false, error: 'Нужно имя или телефон клиента' };
  }

  const headers = { 'Content-Type': 'application/json', 'X-User-Id': userId };

  // 1. Создаём клиента
  let clientId: number | undefined;
  try {
    const resp = await fetch(CLIENTS_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'create',
        name: data.name || 'Заявка (без имени)',
        phone: data.phone || null,
        email: null,
        birthdate: null,
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (json.error === 'CLIENT_LIMIT_REACHED') {
        return { ok: false, error: 'Достигнут лимит клиентов по тарифу' };
      }
      return { ok: false, error: json.error || `Ошибка ${resp.status}` };
    }
    clientId = json.id || json.client?.id;
  } catch {
    return { ok: false, error: 'Сетевая ошибка' };
  }

  if (!clientId) return { ok: true, clientId: undefined };

  // 2. Если названа дата — добавляем бронь/встречу
  let bookingCreated = false;
  if (data.date) {
    const descParts: string[] = ['Заявка через голосового ассистента'];
    if (data.shootType) descParts.push(`Тип: ${data.shootType}`);
    if (data.comment) descParts.push(data.comment);
    try {
      const resp = await fetch(CLIENTS_API, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'add_booking',
          clientId,
          date: data.date,
          time: null,
          description: descParts.join('. '),
          notificationEnabled: true,
          notificationTime: 24,
        }),
      });
      bookingCreated = resp.ok;
    } catch {
      bookingCreated = false;
    }
  }

  return { ok: true, clientId, bookingCreated };
}

export default createBooking;