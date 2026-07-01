import { Project, PhotoItem } from '@/components/clients/ClientsTypes';

export type DraftFields = {
  budget: number;
  startDate: string;
  shootingStyleId?: string;
  shooting_time?: string;
  shooting_duration?: number;
  shooting_address?: string;
  hourly_rate?: number;
  studio_hourly_rate?: number;
  photobook_count?: number;
  photobook_price?: number;
  photo_items: PhotoItem[];
  status: Project['status'];
  cancel_reason?: string;
};

export const PHOTO_FORMAT_PRESETS = ['20×30 (A4)', '15×20', '10×15', '21×30 (A4)', '30×40', '13×18'];

export const toDateInputValue = (value?: string | null) => {
  if (!value || value === 'None' || value === 'null') return '';
  if (typeof value !== 'string') return '';
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
};

export const buildDraftFromProject = (project: Project): DraftFields => ({
  budget: project.budget,
  startDate: toDateInputValue(project.startDate),
  shootingStyleId: project.shootingStyleId,
  shooting_time: project.shooting_time,
  shooting_duration: project.shooting_duration,
  shooting_address: project.shooting_address,
  hourly_rate: project.hourly_rate,
  studio_hourly_rate: project.studio_hourly_rate,
  photobook_count: project.photobook_count,
  photobook_price: project.photobook_price,
  photo_items: Array.isArray(project.photo_items) ? project.photo_items : [],
  status: project.status,
  cancel_reason: project.cancel_reason,
});

// Полный пересчёт бюджета: съёмка + фотокниги + печать фото
export const calcFullBudget = (d: DraftFields): number => {
  const rate = Number(d.hourly_rate) || 0;
  const durationMin = Number(d.shooting_duration) || 0;
  const shooting = rate > 0 ? (durationMin / 60) * rate : 0;
  const studioRate = Number(d.studio_hourly_rate) || 0;
  const studio = studioRate > 0 ? (durationMin / 60) * studioRate : 0;
  const books = (Number(d.photobook_count) || 0) * (Number(d.photobook_price) || 0);
  const photos = (d.photo_items || []).reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0),
    0
  );
  return Math.round(shooting + studio + books + photos);
};
