export const API_URL =
  "https://functions.poehali.dev/06dd3267-2ef6-45bc-899c-50f86e9d36e1";

export interface ClientFolder {
  id: number;
  folder_name: string;
  client_name?: string;
  photo_count: number;
  created_at: string;
}

export interface ClientPhoto {
  id: number;
  file_name: string;
  s3_url: string;
  thumbnail_s3_url?: string;
  file_size?: number;
  created_at: string;
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBytes(bytes: number) {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
