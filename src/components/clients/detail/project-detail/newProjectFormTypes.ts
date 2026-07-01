export interface PhotoItemDraft {
  format: string;
  qty: string;
  price: string;
}

export interface NewProjectData {
  name: string;
  budget: string;
  description: string;
  startDate: string;
  shootingStyleId?: string;
  shooting_time?: string;
  shooting_duration?: number;
  shooting_address?: string;
  add_to_calendar?: boolean;
  hourly_rate?: string;
  studio_hourly_rate?: string;
  photobook_count?: string;
  photobook_price?: string;
  photo_items?: PhotoItemDraft[];
}

export interface NewMeetingDraft {
  name: string;
  meeting_date: string;
  meeting_time: string;
  duration: number;
  address: string;
  description: string;
  custom_reminder_at: string;
}

export const PHOTO_FORMAT_PRESETS = ['20×30 (A4)', '15×20', '10×15', '21×30 (A4)', '30×40', '13×18'];

export const num = (v?: string) => {
  const n = parseFloat((v ?? '').toString().replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

// Полный пересчёт бюджета: съёмка + фотокниги + все строки фото
export const calcTotalBudget = (p: NewProjectData): number => {
  const durationMin = p.shooting_duration || 120;
  const rate = num(p.hourly_rate);
  const shooting = rate > 0 ? (durationMin / 60) * rate : 0;
  const studioRate = num(p.studio_hourly_rate);
  const studio = studioRate > 0 ? (durationMin / 60) * studioRate : 0;
  const books = num(p.photobook_count) * num(p.photobook_price);
  const photos = (p.photo_items ?? []).reduce(
    (sum, it) => sum + num(it.qty) * num(it.price),
    0
  );
  return Math.round(shooting + studio + books + photos);
};
