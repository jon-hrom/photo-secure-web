export interface ParsedBooking {
  name: string;
  phone: string;
  date: string; // YYYY-MM-DD или ''
  shootType: string;
  comment: string;
}

const MONTHS: Record<string, number> = {
  январ: 1, феврал: 2, март: 3, апрел: 4, мая: 5, май: 5, июн: 6, июл: 7,
  август: 8, сентябр: 9, октябр: 10, ноябр: 11, декабр: 12,
};

const DAY_WORDS: Record<string, number> = {
  первого: 1, второго: 2, третьего: 3, четвертого: 4, четвёртого: 4, пятого: 5,
  шестого: 6, седьмого: 7, восьмого: 8, девятого: 9, десятого: 10,
  одиннадцатого: 11, двенадцатого: 12, тринадцатого: 13, четырнадцатого: 14,
  пятнадцатого: 15, шестнадцатого: 16, семнадцатого: 17, восемнадцатого: 18,
  девятнадцатого: 19, двадцатого: 20, двадцать: 20, тридцатого: 30, тридцать: 30,
};

function toISO(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function parseDate(textLower: string): string {
  const now = new Date();

  if (/\bсегодня\b/.test(textLower)) {
    return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
  if (/\bзавтра\b/.test(textLower)) {
    const t = new Date(now.getTime() + 86400000);
    return toISO(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  if (/послезавтра/.test(textLower)) {
    const t = new Date(now.getTime() + 2 * 86400000);
    return toISO(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }

  // 25.08 / 25.08.2026 / 25/08 / 25-08
  const numMatch = textLower.match(/\b(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?\b/);
  if (numMatch) {
    const d = parseInt(numMatch[1], 10);
    const m = parseInt(numMatch[2], 10);
    let y = numMatch[3] ? parseInt(numMatch[3], 10) : now.getFullYear();
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return toISO(y, m, d);
  }

  // "15 августа" / "пятнадцатого августа"
  const monthKey = Object.keys(MONTHS).find((k) => textLower.includes(k));
  if (monthKey) {
    const month = MONTHS[monthKey];
    let day = 0;
    const dNum = textLower.match(new RegExp(`(\\d{1,2})\\s+${monthKey}`));
    if (dNum) day = parseInt(dNum[1], 10);
    if (!day) {
      const dw = Object.keys(DAY_WORDS).find((w) => textLower.includes(w));
      if (dw) day = DAY_WORDS[dw];
    }
    if (day >= 1 && day <= 31) {
      let y = now.getFullYear();
      if (month < now.getMonth() + 1) y += 1;
      return toISO(y, month, day);
    }
  }
  return '';
}

const SHOOT_TYPES: { key: RegExp; label: string }[] = [
  { key: /свадеб|венчан/, label: 'Свадебная съёмка' },
  { key: /love\s*story|лав\s*стори|лавстори/, label: 'Love Story' },
  { key: /семейн/, label: 'Семейная съёмка' },
  { key: /портрет/, label: 'Портретная съёмка' },
  { key: /детск|новорожд|беремен/, label: 'Детская / семейная' },
  { key: /репортаж|корпоратив|мероприят/, label: 'Репортаж / мероприятие' },
  { key: /предметн|каталог/, label: 'Предметная съёмка' },
  { key: /студийн|студи/, label: 'Студийная съёмка' },
];

function parseShootType(textLower: string): string {
  const found = SHOOT_TYPES.find((t) => t.key.test(textLower));
  return found ? found.label : '';
}

function parsePhone(text: string): string {
  const m = text.replace(/[^\d+\s()\-]/g, ' ').match(/(\+?\d[\d\s()\-]{9,}\d)/);
  if (!m) return '';
  const digits = m[1].replace(/\D/g, '');
  if (digits.length < 10) return '';
  const d = digits.slice(-10);
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}

function parseName(text: string): string {
  // "меня зовут Анна", "зовут Иван", "клиент Мария", "имя Дмитрий"
  const m = text.match(/(?:меня зовут|зовут|клиент(?:а)?|имя|это)\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/);
  if (m) return m[1].trim();
  return '';
}

/**
 * Извлекает поля заявки на съёмку из свободной русской речи.
 * Это эвристический парсер для демонстрации; при переходе на Yandex Realtime API
 * извлечение полей выполнит модель через function calling.
 */
export function parseBooking(text: string): ParsedBooking {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  return {
    name: parseName(clean),
    phone: parsePhone(clean),
    date: parseDate(lower),
    shootType: parseShootType(lower),
    comment: clean,
  };
}

export default parseBooking;
