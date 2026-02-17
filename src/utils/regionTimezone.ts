const REGION_TIMEZONE: Record<string, string> = {
  "Калининградская область": "Europe/Kaliningrad",
  "Москва": "Europe/Moscow", "Московская область": "Europe/Moscow",
  "Санкт-Петербург": "Europe/Moscow", "Ленинградская область": "Europe/Moscow",
  "Адыгея": "Europe/Moscow", "Республика Адыгея": "Europe/Moscow",
  "Архангельская область": "Europe/Moscow",
  "Белгородская область": "Europe/Moscow",
  "Брянская область": "Europe/Moscow",
  "Владимирская область": "Europe/Moscow",
  "Вологодская область": "Europe/Moscow",
  "Воронежская область": "Europe/Moscow",
  "Ивановская область": "Europe/Moscow",
  "Калужская область": "Europe/Moscow",
  "Карелия": "Europe/Moscow", "Республика Карелия": "Europe/Moscow",
  "Коми": "Europe/Moscow", "Республика Коми": "Europe/Moscow",
  "Костромская область": "Europe/Moscow",
  "Краснодарский край": "Europe/Moscow",
  "Курская область": "Europe/Moscow",
  "Липецкая область": "Europe/Moscow",
  "Марий Эл": "Europe/Moscow", "Республика Марий Эл": "Europe/Moscow",
  "Мордовия": "Europe/Moscow", "Республика Мордовия": "Europe/Moscow",
  "Мурманская область": "Europe/Moscow",
  "Ненецкий автономный округ": "Europe/Moscow",
  "Нижегородская область": "Europe/Moscow",
  "Новгородская область": "Europe/Moscow",
  "Орловская область": "Europe/Moscow",
  "Пензенская область": "Europe/Moscow",
  "Псковская область": "Europe/Moscow",
  "Ростовская область": "Europe/Moscow",
  "Рязанская область": "Europe/Moscow",
  "Смоленская область": "Europe/Moscow",
  "Тамбовская область": "Europe/Moscow",
  "Тверская область": "Europe/Moscow",
  "Тульская область": "Europe/Moscow",
  "Ярославская область": "Europe/Moscow",
  "Кабардино-Балкария": "Europe/Moscow", "Кабардино-Балкарская Республика": "Europe/Moscow",
  "Карачаево-Черкесия": "Europe/Moscow", "Карачаево-Черкесская Республика": "Europe/Moscow",
  "Северная Осетия": "Europe/Moscow", "Республика Северная Осетия — Алания": "Europe/Moscow",
  "Чечня": "Europe/Moscow", "Чеченская Республика": "Europe/Moscow",
  "Ингушетия": "Europe/Moscow", "Республика Ингушетия": "Europe/Moscow",
  "Дагестан": "Europe/Moscow", "Республика Дагестан": "Europe/Moscow",
  "Ставропольский край": "Europe/Moscow",
  "Крым": "Europe/Moscow", "Республика Крым": "Europe/Moscow",
  "Севастополь": "Europe/Moscow",
  "Волгоградская область": "Europe/Moscow",
  "Кировская область": "Europe/Moscow",
  "Татарстан": "Europe/Moscow", "Республика Татарстан": "Europe/Moscow",
  "Чувашия": "Europe/Moscow", "Чувашская Республика": "Europe/Moscow",
  "Астраханская область": "Europe/Samara",
  "Самарская область": "Europe/Samara",
  "Саратовская область": "Europe/Samara",
  "Удмуртия": "Europe/Samara", "Удмуртская Республика": "Europe/Samara",
  "Ульяновская область": "Europe/Samara",
  "Башкортостан": "Asia/Yekaterinburg", "Республика Башкортостан": "Asia/Yekaterinburg",
  "Курганская область": "Asia/Yekaterinburg",
  "Оренбургская область": "Asia/Yekaterinburg",
  "Пермский край": "Asia/Yekaterinburg",
  "Свердловская область": "Asia/Yekaterinburg",
  "Тюменская область": "Asia/Yekaterinburg",
  "Челябинская область": "Asia/Yekaterinburg",
  "Ханты-Мансийский автономный округ": "Asia/Yekaterinburg",
  "Ямало-Ненецкий автономный округ": "Asia/Yekaterinburg",
  "Алтайский край": "Asia/Barnaul",
  "Республика Алтай": "Asia/Barnaul",
  "Кемеровская область": "Asia/Novokuznetsk",
  "Новосибирская область": "Asia/Novosibirsk",
  "Омская область": "Asia/Omsk",
  "Томская область": "Asia/Tomsk",
  "Красноярский край": "Asia/Krasnoyarsk",
  "Тыва": "Asia/Krasnoyarsk", "Республика Тыва": "Asia/Krasnoyarsk",
  "Хакасия": "Asia/Krasnoyarsk", "Республика Хакасия": "Asia/Krasnoyarsk",
  "Иркутская область": "Asia/Irkutsk",
  "Бурятия": "Asia/Irkutsk", "Республика Бурятия": "Asia/Irkutsk",
  "Забайкальский край": "Asia/Chita",
  "Амурская область": "Asia/Yakutsk",
  "Саха (Якутия)": "Asia/Yakutsk", "Республика Саха (Якутия)": "Asia/Yakutsk",
  "Еврейская автономная область": "Asia/Vladivostok",
  "Приморский край": "Asia/Vladivostok",
  "Хабаровский край": "Asia/Vladivostok",
  "Магаданская область": "Asia/Magadan",
  "Сахалинская область": "Asia/Sakhalin",
  "Камчатский край": "Asia/Kamchatka",
  "Чукотский автономный округ": "Asia/Kamchatka",
};

export function getTimezoneForRegion(region?: string): string {
  if (!region) return "Europe/Moscow";
  return REGION_TIMEZONE[region] || "Europe/Moscow";
}

const TZ_OFFSETS: Record<string, number> = {
  "Europe/Kaliningrad": 2,
  "Europe/Moscow": 3,
  "Europe/Samara": 4,
  "Asia/Yekaterinburg": 5,
  "Asia/Omsk": 6,
  "Asia/Barnaul": 7,
  "Asia/Novosibirsk": 7,
  "Asia/Novokuznetsk": 7,
  "Asia/Tomsk": 7,
  "Asia/Krasnoyarsk": 7,
  "Asia/Irkutsk": 8,
  "Asia/Chita": 9,
  "Asia/Yakutsk": 9,
  "Asia/Vladivostok": 10,
  "Asia/Magadan": 11,
  "Asia/Sakhalin": 11,
  "Asia/Kamchatka": 12,
};

export function getUserTimezoneLabel(): string {
  const region = localStorage.getItem('user_region') || '';
  const city = localStorage.getItem('user_city') || '';
  const tz = getTimezoneForRegion(region);
  const offset = TZ_OFFSETS[tz] ?? 3;
  const cityLabel = city || region || 'Москва';
  return `UTC+${offset}, ${cityLabel}`;
}

export function getUserTimezoneShort(): string {
  const region = localStorage.getItem('user_region') || '';
  const tz = getTimezoneForRegion(region);
  const offset = TZ_OFFSETS[tz] ?? 3;
  return `UTC+${offset}`;
}

export default REGION_TIMEZONE;