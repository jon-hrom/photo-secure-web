export interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  preview_url?: string;
  width?: number;
  height?: number;
  file_size: number;
  s3_key?: string;
}

export interface FavoritePhoto {
  photo_id: number;
  added_at?: string;
  file_name?: string;
  photo_url?: string;
  thumbnail_url?: string;
  preview_url?: string;
  width?: number | null;
  height?: number | null;
  file_size?: number;
  s3_key?: string;
}

export const FAVORITES_URL = 'https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723';
