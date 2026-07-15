import funcUrls from '../../backend/func2url.json';

const URL = (funcUrls as Record<string, string>)['portfolio'];

export interface PortfolioCategory {
  id: number;
  title: string;
  slug: string;
  cover_url: string;
  sort_order: number;
}

export interface PortfolioShooting {
  id: number;
  category_id: number;
  title: string;
  slug: string;
  cover_url: string;
  sort_order: number;
}

export interface PortfolioPhoto {
  id: number;
  category_id: number | null;
  shooting_id: number | null;
  photo_url: string;
  thumbnail_url: string;
  grid_thumbnail_url: string;
  source: string;
  sort_order: number;
}

export interface PortfolioReview {
  id: number;
  author_name: string;
  text: string;
  rating: number;
  avatar_url: string;
  sort_order: number;
}

export interface Portfolio {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  about: string;
  phone: string;
  email: string;
  instagram: string;
  telegram: string;
  vk: string;
  whatsapp: string;
  max: string;
  avatar_url: string;
  cover_url: string;
  accent_color: string;
  menu_position: string;
  logo_text: string;
  show_reviews: boolean;
  show_about: boolean;
  show_stories_block: boolean;
  slideshow_enabled: boolean;
  is_published: boolean;
  views_count: number;
  categories: PortfolioCategory[];
  shootings: PortfolioShooting[];
  photos: PortfolioPhoto[];
  reviews: PortfolioReview[];
  user_profile?: { name?: string; display_name?: string; city?: string; phone?: string; email?: string; avatar_url?: string };
}

const authHeaders = (userId: string | number) => ({
  'Content-Type': 'application/json',
  'X-User-Id': String(userId),
});

export const getMyPortfolio = async (userId: string | number): Promise<Portfolio> => {
  const r = await fetch(URL, { method: 'GET', headers: authHeaders(userId) });
  const d = await r.json();
  return d.portfolio;
};

export const savePortfolio = async (userId: string | number, body: Record<string, unknown>): Promise<{ ok: boolean; portfolio?: Portfolio; error?: string }> => {
  const r = await fetch(URL, { method: 'POST', headers: authHeaders(userId), body: JSON.stringify({ action: 'save_settings', ...body }) });
  const d = await r.json();
  if (!r.ok) return { ok: false, error: d.error };
  return { ok: true, portfolio: d.portfolio };
};

export const portfolioAction = async (userId: string | number, action: string, body: Record<string, unknown> = {}): Promise<Portfolio> => {
  const r = await fetch(URL, { method: 'POST', headers: authHeaders(userId), body: JSON.stringify({ action, ...body }) });
  const d = await r.json();
  return d.portfolio;
};

export const checkSlug = async (slug: string, excludeUser: string | number): Promise<{ available: boolean; slug: string }> => {
  const r = await fetch(`${URL}?action=check_slug&slug=${encodeURIComponent(slug)}&exclude_user=${excludeUser}`);
  return r.json();
};

export const getPublicPortfolio = async (slug: string): Promise<Portfolio | null> => {
  const r = await fetch(`${URL}?action=public&slug=${encodeURIComponent(slug)}`);
  if (!r.ok) return null;
  const d = await r.json();
  return d.portfolio || null;
};