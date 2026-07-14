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
 * Предлагает варианты slug из имени и фамилии.
 * Пример: name="Евгений Пономарёв" → ["ponomarev-evgeniy", "evgeniy-ponomarev", "ponomarev-pro", ...]
 */
export const suggestSlugs = (fullName: string): string[] => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  const variants = new Set<string>();
  if (parts.length >= 2) {
    const [first, last] = parts;
    variants.add(slugify(`${last} ${first}`));
    variants.add(slugify(`${first} ${last}`));
    variants.add(slugify(`${last}-pro`));
    variants.add(slugify(`${first}-photo`));
    variants.add(slugify(`${last}_${first}`));
  } else if (parts.length === 1) {
    variants.add(slugify(parts[0]));
    variants.add(slugify(`${parts[0]}-pro`));
    variants.add(slugify(`${parts[0]}-photo`));
  }
  return Array.from(variants).filter(Boolean);
};

export default slugify;
