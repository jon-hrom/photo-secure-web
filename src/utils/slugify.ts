const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Транслитерация в латинский slug: "Пономарёв Евгений" → "ponomarev-evgeniy". */
export const slugify = (text: string): string => {
  const lower = (text || '').toLowerCase().trim();
  let out = '';
  for (const ch of lower) out += TRANSLIT[ch] ?? ch;
  return out
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
};

/**
 * Предлагает варианты slug на основе введённого текста (имя, фамилия или адрес).
 * Пример: "Евгений Пономарёв" / "evgeniy-ponomarev" → ["ponomarev-evgeniy", "evgeniy-ponomarev", "evgeniy-ponomarev-pro", "evgeniy-ponomarev-photo"]
 */
export const suggestSlugs = (source: string): string[] => {
  const base = slugify(source);
  if (!base) return [];
  const parts = base.split('-').filter(Boolean);
  const variants = new Set<string>();
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    variants.add(`${last}-${first}`);
    variants.add(base);
    variants.add(`${base}-pro`);
    variants.add(`${base}-photo`);
  } else {
    variants.add(base);
    variants.add(`${base}-pro`);
    variants.add(`${base}-photo`);
    variants.add(`${base}-studio`);
  }
  return Array.from(variants).filter(Boolean);
};

export default slugify;