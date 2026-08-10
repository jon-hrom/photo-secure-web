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

  if (/послезавтра/.test(textLower)) {
    const t = new Date(now.getTime() + 2 * 86400000);
    return toISO(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  if (/(^|[^а-яё])сегодня(?![а-яё])/.test(textLower)) {
    return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
  if (/(^|[^а-яё])завтра(?![а-яё])/.test(textLower)) {
    const t = new Date(now.getTime() + 86400000);
    return toISO(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }

  // 25.08 / 25.08.2026 / 25/08 (дефис не берём — он встречается в телефонах)
  const numMatch = textLower.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
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

// Порядок важен: длинные слова идут раньше коротких («восемьдесят» до «восемь»)
const NUM_WORD_MAP: [string, string][] = [
  ['девятнадцать', '19'], ['восемнадцать', '18'], ['семнадцать', '17'],
  ['шестнадцать', '16'], ['пятнадцать', '15'], ['четырнадцать', '14'],
  ['тринадцать', '13'], ['двенадцать', '12'], ['одиннадцать', '11'],
  ['девяносто', '90'], ['восемьдесят', '80'], ['семьдесят', '70'],
  ['шестьдесят', '60'], ['пятьдесят', '50'], ['сорок', '40'],
  ['тридцать', '30'], ['двадцать', '20'], ['десять', '10'],
  ['девятьсот', '900'], ['восемьсот', '800'], ['семьсот', '700'],
  ['шестьсот', '600'], ['пятьсот', '500'], ['четыреста', '400'],
  ['триста', '300'], ['двести', '200'], ['сто', '100'],
  ['девять', '9'], ['восемь', '8'], ['семь', '7'], ['шесть', '6'],
  ['пять', '5'], ['четыре', '4'], ['три', '3'],
  ['две', '2'], ['два', '2'], ['одна', '1'], ['один', '1'],
  ['ноль', '0'], ['нуль', '0'],
];

// \b не работает с кириллицей — используем явные границы по буквам
const NUM_WORDS: [RegExp, string][] = NUM_WORD_MAP.map(([word, digit]) => [
  new RegExp(`(^|[^а-яё])${word}(?![а-яё])`, 'gi'),
  digit,
]);

// «восемьсот девяносто пять» → 895: складываем, пока каждое следующее меньше предыдущего
function mergeNumberWords(text: string): string {
  const tokens = text.split(/(\s+)/);
  const out: string[] = [];
  let acc = 0;
  let prev = 0;
  let open = false;

  const flush = () => {
    if (open) out.push(String(acc));
    acc = 0;
    prev = 0;
    open = false;
  };

  for (const token of tokens) {
    if (/^\s+$/.test(token)) continue;
    const isSpoken = /^\d+$/.test(token) && token.length <= 3;
    const value = isSpoken ? parseInt(token, 10) : NaN;
    const scale = value < 10 ? 10 : value < 100 ? 100 : 1000;
    const canMerge = open && value < prev && prev % scale === 0;

    if (isSpoken && (!open || canMerge)) {
      acc += value;
      prev = value;
      open = true;
      continue;
    }
    flush();
    if (isSpoken) {
      acc = value;
      prev = value;
      open = true;
    } else {
      out.push(token);
    }
  }
  flush();
  return out.join(' ');
}

function wordsToDigits(text: string): string {
  let out = text.toLowerCase().replace(/(^|[^а-яё])плюс(?![а-яё])/gi, '$1 + ');
  let changed = false;
  for (const [re, val] of NUM_WORDS) {
    re.lastIndex = 0;
    if (!re.test(out)) continue;
    re.lastIndex = 0;
    out = out.replace(re, `$1 ${val} `);
    changed = true;
  }
  return changed ? mergeNumberWords(out) : out;
}

function formatPhone(ten: string): string {
  return `+7 (${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6, 8)}-${ten.slice(8)}`;
}

function normalizePhone(digits: string): string {
  let d = digits;
  if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = d.slice(1);
  if (d.length === 12 && d.startsWith('07')) d = d.slice(2);
  if (d.length !== 10) return '';
  if (d[0] !== '9') return '';
  return formatPhone(d);
}

function parsePhone(text: string): string {
  const prepared = wordsToDigits(text);

  // Убираем дату/время, чтобы их цифры не попали в номер
  const withoutDates = prepared
    .replace(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/g, ' | ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' | ');

  // Собираем последовательности цифр, разделённые только пробелами/скобками/дефисами
  const chunks = withoutDates.match(/\+?\d[\d\s()\-+]*/g) || [];

  for (const chunk of chunks) {
    const digits = chunk.replace(/\D/g, '');
    if (digits.length < 10) continue;

    // Точное совпадение по длине
    const direct = normalizePhone(digits);
    if (direct) return direct;

    // Номер внутри длинной строки цифр: ищем начало с 8/7/9
    for (let i = 0; i <= digits.length - 10; i++) {
      if (digits[i] === '8' || digits[i] === '7') {
        const candidate = normalizePhone(digits.slice(i, i + 11));
        if (candidate) return candidate;
      }
      if (digits[i] === '9') {
        const candidate = normalizePhone(digits.slice(i, i + 10));
        if (candidate) return candidate;
      }
    }
  }
  return '';
}

// Слова, которые пишутся с большой буквы, но именем не являются
const NOT_NAMES = /^(свадебн|семейн|портретн|детск|студийн|предметн|репортаж|корпоратив|мероприят|съёмк|съемк|телефон|номер|дата|клиент|запис|завтра|сегодня|послезавтра|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|love|story)/i;

function parseName(text: string): string {
  // "меня зовут Анна", "зовут Иван", "клиент Мария", "имя Дмитрий", "записать Ивана"
  const m = text.match(
    /(?:[Мм]еня зовут|[Зз]овут|[Кк]лиент(?:ка|а)?|[Ии]мя|[Ээ]то|[Зз]апиши(?:те)?|[Зз]аписать|[Дд]обавь(?:те)?)\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)/,
  );
  if (m && !NOT_NAMES.test(m[1])) return m[1].trim();

  // Иначе — первое слово с большой буквы, не входящее в стоп-лист
  const candidates = text.match(/[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?/g) || [];
  for (const c of candidates) {
    if (!NOT_NAMES.test(c)) return c.trim();
  }
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