// В MAX нельзя открыть чат по номеру телефона — работают только ссылки на профиль
// (max.ru/ник или ссылка из приложения). Поэтому номер для MAX-кнопки не годится.
export const isMaxPhone = (raw: string): boolean => {
  const v = (raw || '').trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v) || /^max\.(ru|me)\//i.test(v)) return false;
  const digits = v.replace(/[^\d]/g, '');
  return /^[+\d][\d\s()\-]+$/.test(v) && digits.length >= 10;
};

// Строит корректную ссылку на MAX по нику или готовой ссылке.
// Для номера телефона вернёт '' (ссылки MAX по номеру не существует).
export const maxHref = (raw: string): string => {
  const v = (raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^max\.(ru|me)\//i.test(v)) return `https://${v}`;
  if (isMaxPhone(v)) return '';
  return `https://max.ru/${v.replace(/^@/, '')}`;
};

export interface ContactEntry { icon?: string; img?: string; label: string; href: string }

// Возвращает контакт-кнопку из значения поля.
// source='whatsapp' — поле WhatsApp: номер превращаем в кнопку WhatsApp (wa.me работает по номеру).
// source='max'      — поле MAX: только ник/ссылка → кнопка MAX. В MAX нельзя открыть чат по номеру
//                     телефона, поэтому номер в этом поле НЕ превращаем в WhatsApp (это чужой канал),
//                     а просто не создаём кнопку.
export const maxContacts = (
  raw: string | undefined | null,
  maxIcon: string,
  source: 'max' | 'whatsapp' = 'max',
): ContactEntry[] => {
  const v = (raw || '').trim();
  if (!v) return [];
  if (isMaxPhone(v)) {
    if (source !== 'whatsapp') return [];
    let phone = v.replace(/[^\d]/g, '');
    if (phone.length === 11 && phone.startsWith('8')) phone = '7' + phone.slice(1);
    return [{ icon: 'MessageCircle', label: 'WhatsApp', href: `https://wa.me/${phone}` }];
  }
  const href = maxHref(v);
  return href ? [{ img: maxIcon, label: 'MAX', href }] : [];
};