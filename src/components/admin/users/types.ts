export interface User {
  id: string | number;
  source: 'email' | 'vk' | 'google' | 'yandex' | 'telegram' | string;
  vk_id?: string | null;
  telegram_id?: string | null;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_active: boolean;
  is_blocked: boolean;
  ip_address: string | null;
  last_login: string | null;
  last_seen_at?: string | null;
  user_agent: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  registered_at: string | null;
}

export interface EnhancedAdminUsersProps {
  users: User[];
  onBlock: (userId: string | number, reason: string) => void;
  onUnblock: (userId: string | number) => void;
  onDelete: (userId: string | number) => void;
  onRefresh?: () => void;
  onOpenPhotoBank?: (userId: string | number) => void;
}

// Даты с бэкенда хранятся в UTC (timestamp without time zone) и приходят
// строкой без таймзоны, напр. "2026-02-17T12:26:00". Помечаем её как UTC,
// иначе браузер посчитает её локальной и время «поедет».
const parseUtc = (dateStr: string): Date => {
  const s = String(dateStr).trim();
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  return new Date(hasTz ? normalized : normalized + 'Z');
};

export const isUserOnline = (lastLogin: string | null): boolean => {
  if (!lastLogin) return false;
  const lastLoginDate = parseUtc(lastLogin);
  const now = new Date();
  const diffInMinutes = (now.getTime() - lastLoginDate.getTime()) / 1000 / 60;
  return diffInMinutes < 5;
};

// Онлайн «сейчас на сайте» для любого способа входа (email/VK/Yandex/Telegram):
// берём самое свежее из last_seen_at (обновляется при активности на сайте) и last_login.
export const isOnline = (user: { last_seen_at?: string | null; last_login: string | null }): boolean => {
  const times = [user.last_seen_at, user.last_login]
    .filter(Boolean)
    .map((t) => parseUtc(t as string).getTime());
  if (times.length === 0) return false;
  const latest = Math.max(...times);
  return (Date.now() - latest) / 1000 / 60 < 5;
};

export const formatDate = (dateStr: string) => {
  const samaraTime = parseUtc(dateStr).toLocaleString('ru-RU', {
    timeZone: 'Europe/Samara',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${samaraTime} (UTC+4)`;
};

export const getRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return 'Никогда';

  const date = parseUtc(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Только что';
  if (diffInSeconds < 300) return `${Math.floor(diffInSeconds / 60)} мин. назад`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин. назад`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч. назад`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} дн. назад`;

  return formatDate(dateStr);
};

export const getSourceLabel = (source: string) => {
  const labels: Record<string, string> = {
    'email': 'Email',
    'vk': 'VK ID',
    'google': 'Google',
    'yandex': 'Яндекс',
    'telegram': 'Telegram'
  };
  return labels[source] || source;
};

// Все способы входа, привязанные к аккаунту (даже если основной source другой)
export const getUserProviders = (user: {
  source: string;
  vk_id?: string | null;
  telegram_id?: string | null;
}): string[] => {
  const providers = new Set<string>();
  if (user.source) providers.add(user.source);
  if (user.vk_id) providers.add('vk');
  if (user.telegram_id) providers.add('telegram');
  return Array.from(providers);
};

export const exportToCSV = (users: User[]) => {
  const csvHeaders = [
    'ID',
    'Источник',
    'Имя',
    'Email',
    'Телефон',
    'Статус',
    'Заблокирован',
    'IP адрес',
    'Дата регистрации',
    'Последний вход',
    'Браузер/Устройство',
    'Причина блокировки'
  ].join(',');

  const csvRows = users.map(user => [
    user.id,
    getSourceLabel(user.source),
    user.full_name || '',
    user.email || '',
    user.phone || '',
    user.is_active ? 'Активен' : 'Неактивен',
    user.is_blocked ? 'Да' : 'Нет',
    user.ip_address || '',
    user.registered_at || user.created_at,
    user.last_login || '',
    user.user_agent || '',
    user.blocked_reason || ''
  ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));

  const csvContent = [csvHeaders, ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};