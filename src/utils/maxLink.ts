// Строит корректную ссылку на MAX.
// Правила:
//  - уже полная ссылка (http… или max.ru/…) — используем как есть;
//  - никнейм — https://max.ru/ник;
//  - номер телефона — https://max.ru/+7… (MAX открывает чат по номеру с + и кодом страны).
export const maxHref = (raw: string): string => {
  const v = (raw || '').trim();
  if (!v) return '';

  if (/^https?:\/\//i.test(v)) return v;
  if (/^max\.(ru|me)\//i.test(v)) return `https://${v}`;

  // Только цифры (возможно с +, скобками, дефисами) — это номер телефона
  const digits = v.replace(/[^\d]/g, '');
  const looksLikePhone = /^[+\d][\d\s()\-]+$/.test(v) && digits.length >= 10;
  if (looksLikePhone) {
    let phone = digits;
    if (phone.length === 11 && phone.startsWith('8')) phone = '7' + phone.slice(1);
    return `https://max.ru/+${phone}`;
  }

  // Иначе — никнейм
  return `https://max.ru/${v.replace(/^@/, '')}`;
};
