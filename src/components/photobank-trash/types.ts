export interface TrashedFolder {
  id: number;
  folder_name: string;
  s3_prefix: string;
  trashed_at: string;
  auto_delete_date?: string;
  photo_count: number;
}

export interface TrashedPhoto {
  id: number;
  file_name: string;
  s3_key: string;
  s3_url: string;
  file_size: number;
  width: number | null;
  height: number | null;
  trashed_at: string;
  auto_delete_date?: string;
  folder_name: string;
}